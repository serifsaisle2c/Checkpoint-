// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CheckInToken} from "./CheckInToken.sol";
import {CheckInBadge} from "./CheckInBadge.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title EncryptedCheckIn - 加密打卡 DApp（单合约实现）
/// @notice 使用 FHE 同态运算维护用户的累计签到次数，结合每日限制与奖励（ERC20 代币与徽章 NFT）。
/// @dev FHE 使用方式与 Zama 官方示例保持一致：
///      - 前端 createEncryptedInput -> externalEuint32 + inputProof
///      - 合约 FHE.fromExternal 验证并导入为 euint32
///      - 使用 FHE.add 做同态累加
///      - 每次更新密文都对新句柄授权：FHE.allowThis(...) 与 FHE.allow(..., msg.sender)
contract EncryptedCheckIn is SepoliaConfig, Ownable {
    // -------------------------------
    // 常量与配置
    // -------------------------------
    uint256 public constant REWARD_PER_CHECKIN = 10 ether; // ERC20 奖励
    uint256 public constant BADGE_STREAK_DAYS = 7; // 连续签到阈值授予徽章
    uint256 public constant REDEEM_BADGE_COST = 100 ether; // 代币兑换徽章成本

    // 开发模式：为 true 时取消每日签到限制
    bool public devMode;

    // -------------------------------
    // 用户状态
    // -------------------------------
    struct UserState {
        // 累计签到次数（密文）
        euint32 total;
        // 累计签到次数（明文，便于业务判定 7 的倍数门槛）
        uint32 totalClear;
        // 最后签到日（UTC 天粒度），用于每日一次限制
        uint64 lastDay;
        // 连续签到天数（明文，业务用途）
        uint32 streak;
        // 已领取徽章次数（每满 BADGE_STREAK_DAYS 可领取一次）
        uint32 badgesClaimed;
    }

    struct Entry { uint64 day; bytes32 memoHash; }

    mapping(address => UserState) private _users;
    mapping(address => Entry[]) private _entries;

    // 外部合约
    CheckInToken public immutable token;
    CheckInBadge public immutable badge;

    event CheckedIn(address indexed user, uint64 day, bytes32 indexed memoHash);
    event RewardMinted(address indexed user, uint256 amount);
    event BadgeMinted(address indexed user, uint256 tokenId);
    event DevModeChanged(bool enabled);

    constructor(address token_, address badge_) Ownable(msg.sender) {
        token = CheckInToken(token_);
        badge = CheckInBadge(badge_);
    }

    // -------------------------------
    // 只读查询
    // -------------------------------
    function getEncryptedTotal(address user) external view returns (euint32) {
        return _users[user].total;
    }

    function getLastDay(address user) external view returns (uint64) {
        return _users[user].lastDay;
    }

    function hasBadge(address user) external view returns (bool) {
        return _users[user].badgesClaimed > 0;
    }

    function getStreak(address user) external view returns (uint32) {
        return _users[user].streak;
    }

    function getEntries(address user) external view returns (Entry[] memory) {
        return _entries[user];
    }

    function getBadgesClaimed(address user) external view returns (uint32) {
        return _users[user].badgesClaimed;
    }

    function getTotalClear(address user) external view returns (uint32) {
        return _users[user].totalClear;
    }

    /// @notice 设置开发模式，仅所有者可调用
    function setDevMode(bool enabled) external onlyOwner {
        devMode = enabled;
        emit DevModeChanged(enabled);
    }

    // -------------------------------
    // 核心：签到（同态 + 授权）
    // -------------------------------
    /// @param memoHash 前端对签到备注明文做 keccak256，链上仅存哈希
    /// @param deltaEncrypted externalEuint32（前端通常传 1）
    /// @param inputProof 零知识证明
    function checkIn(
        bytes32 memoHash,
        externalEuint32 deltaEncrypted,
        bytes calldata inputProof
    ) external {
        uint64 day = _todayUTC();
        // 每日一次限制（非开发模式）
        if (!devMode) {
            require(_users[msg.sender].lastDay != day, "Already checked in today");
        }

        // 同态导入 + 累加
        euint32 delta = FHE.fromExternal(deltaEncrypted, inputProof);
        _users[msg.sender].total = FHE.add(_users[msg.sender].total, delta);
        // 维护明文累计计数（仅为前端与业务门槛判断使用，非敏感）
        unchecked { _users[msg.sender].totalClear += 1; }

        // 授权最新句柄
        FHE.allowThis(_users[msg.sender].total);
        FHE.allow(_users[msg.sender].total, msg.sender);

        // 更新日期与事件 + 连续天数 + 记录明细
        uint64 last = _users[msg.sender].lastDay;
        if (last != day) {
            if (last + 1 == day) {
                unchecked { _users[msg.sender].streak += 1; }
            } else {
                _users[msg.sender].streak = 1;
            }
            _users[msg.sender].lastDay = day;
        }
        _entries[msg.sender].push(Entry({ day: day, memoHash: memoHash }));
        emit CheckedIn(msg.sender, day, memoHash);

        // 发放 ERC20 奖励（演示：每次签到固定奖励）
        token.mint(msg.sender, REWARD_PER_CHECKIN);
        emit RewardMinted(msg.sender, REWARD_PER_CHECKIN);

        // 徽章发放策略：
        // - 方式一：连续签到达到阈值后，用户可调用 claimBadgeByStreak()
        // - 方式二：消耗代币兑换徽章 redeemBadgeWithToken()
    }

    /// @notice 连续签到达到阈值后，由用户自助领取徽章
    function claimBadgeByStreak() external {
        if (!devMode) {
            uint32 daysPerBadge = uint32(BADGE_STREAK_DAYS);
            uint32 totalDays = _users[msg.sender].totalClear;
            require(totalDays > 0 && totalDays % daysPerBadge == 0, "Not multiple of 7");
            uint32 thresholdIndex = totalDays / daysPerBadge; // 7,14,21... -> 1,2,3...
            require(thresholdIndex > _users[msg.sender].badgesClaimed, "Already claimed");
        }
        uint256 tokenId = badge.mintTo(msg.sender);
        unchecked { _users[msg.sender].badgesClaimed += 1; }
        emit BadgeMinted(msg.sender, tokenId);
    }

    /// @notice 使用代币兑换徽章
    function redeemBadgeWithToken() external {
        token.burnFrom(msg.sender, REDEEM_BADGE_COST);
        uint256 tokenId = badge.mintTo(msg.sender);
        unchecked { _users[msg.sender].badgesClaimed += 1; }
        emit BadgeMinted(msg.sender, tokenId);
    }

    // -------------------------------
    // 工具
    // -------------------------------
    function _todayUTC() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }
}


