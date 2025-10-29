import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "../fhevm/useFhevm";
import { useCheckIn } from "../hooks/useCheckIn";
import { EncryptedCheckInAddresses } from "../abi/EncryptedCheckInAddresses";
import { 
  Button, 
  Card, 
  Input, 
  StatusBadge, 
  ShieldCheckIcon, 
  CalendarIcon, 
  LockIcon, 
  RefreshIcon, 
  EyeIcon, 
  BadgeIcon, 
  MessageIcon, 
  ChainIcon 
} from "../components";

export function App() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const w = (window as any).ethereum as ethers.Eip1193Provider | undefined;
    if (!w) return;
    setProvider(w);
    (async () => {
      const _chainId = await w.request({ method: "eth_chainId" });
      setChainId(parseInt(_chainId as string, 16));
    })();
  }, []);

  const { instance, status } = useFhevm({ provider, chainId, enabled: true });

  useEffect(() => {
    if (!provider) return;
    const p = new ethers.BrowserProvider(provider);
    (async () => {
      try {
        await provider.request?.({ method: "eth_requestAccounts" });
        const s = await p.getSigner();
        setSigner(s);
      } catch {}
    })();
  }, [provider]);

  const { memo, setMemo, refresh, decrypt, checkIn, claimReward, handle, clear, message, canRefresh, canDecrypt, canWrite, canClaim, devMode, totalClear, badgesClaimed } = useCheckIn({ instance, chainId, signer, provider });

  const currentAddress = useMemo(() => (chainId ? (EncryptedCheckInAddresses as any)[String(chainId)]?.address : undefined), [chainId]);

  const getStatusType = (status: string) => {
    if (status === 'ready') return 'connected';
    if (status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return 'disconnected';
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return 'Not deployed';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheckIcon className="w-12 h-12 text-primary-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Encrypted CheckIn</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Secure daily check-ins powered by FHEVM encryption technology. 
            Your privacy is protected with fully homomorphic encryption.
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-slide-up">
          <Card className="text-center">
            <div className="flex items-center justify-center mb-3">
              <LockIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">FHEVM Status</h3>
            <StatusBadge status={getStatusType(status)}>
              {status || 'Disconnected'}
            </StatusBadge>
          </Card>

          <Card className="text-center">
            <div className="flex items-center justify-center mb-3">
              <ChainIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Chain ID</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {chainId ?? "Unknown"}
            </span>
          </Card>

          <Card className="text-center">
            <div className="flex items-center justify-center mb-3">
              <BadgeIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Contract</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
              {formatAddress(currentAddress)}
            </span>
          </Card>
        </div>

        {/* Main CheckIn Interface */}
        <Card className="mb-8 animate-slide-up" padding="lg">
          <div className="flex items-center mb-6">
            <CalendarIcon className="w-6 h-6 text-primary-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Daily Check-In</h2>
          </div>

          <div className="space-y-6">
            {/* Memo Input */}
            <Input
              label="Check-in Message"
              placeholder="Enter your daily check-in note (any text)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              icon={<MessageIcon className="w-5 h-5" />}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                onClick={refresh}
                disabled={!canRefresh}
                variant="outline"
                className="w-full"
              >
                <RefreshIcon className="w-4 h-4 mr-2" />
                Get My Handle
              </Button>

              <Button
                onClick={checkIn}
                disabled={!canWrite}
                variant="primary"
                className="w-full"
                loading={!canWrite && memo.length > 0}
              >
                <LockIcon className="w-4 h-4 mr-2" />
                Check In (Encrypted)
              </Button>

              <Button
                onClick={decrypt}
                disabled={!canDecrypt}
                variant="success"
                className="w-full"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Decrypt Count
              </Button>

              <Button
                onClick={claimReward}
                disabled={!canClaim}
                variant="secondary"
                className="w-full"
              >
                <BadgeIcon className="w-4 h-4 mr-2" />
                Claim Reward
              </Button>
            </div>

            {/* Status Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encrypted Handle
                </label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <code className="text-sm text-gray-600 break-all">
                    {handle ? `${handle.slice(0, 20)}...` : "Not available"}
                  </code>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decrypted Count
                </label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <span className="text-lg font-semibold text-gray-900">
                    {clear === undefined ? "Not decrypted" : String(clear)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Eligibility
                </label>
                <div className="p-3 bg-gray-50 rounded-lg border space-y-1">
                  <div className="text-sm text-gray-700">devMode: {devMode === undefined ? '...' : String(devMode)}</div>
                  <div className="text-sm text-gray-700">totalClear: {totalClear === undefined ? '...' : String(totalClear)}</div>
                  <div className="text-sm text-gray-700">badgesClaimed: {badgesClaimed === undefined ? '...' : String(badgesClaimed)}</div>
                  <div className="text-sm font-semibold text-gray-900">canClaim: {String(canClaim)}</div>
                </div>
              </div>
            </div>

            {/* Message Display */}
            {message && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700 font-mono break-all">{message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Badge Information */}
        <Card className="animate-slide-up" padding="lg">
          <div className="flex items-center mb-6">
            <BadgeIcon className="w-6 h-6 text-success-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Earn Badges</h2>
          </div>

          <div className="bg-gradient-to-r from-success-50 to-primary-50 p-6 rounded-lg border border-success-200">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center">
                  <BadgeIcon className="w-6 h-6 text-success-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How to Earn Badges
                </h3>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-success-100 text-success-800 text-xs font-medium rounded-full mr-3 mt-0.5">
                      1
                    </span>
                    <p>
                      <strong>7-Day Streak:</strong> Check in daily for 7 consecutive days, then call{' '}
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">claimBadgeByStreak</code>{' '}
                      in your wallet to claim your streak badge.
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-800 text-xs font-medium rounded-full mr-3 mt-0.5">
                      2
                    </span>
                    <p>
                      <strong>Token Exchange:</strong> Spend 100 CHK tokens by calling{' '}
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm">redeemBadgeWithToken</code>{' '}
                      to instantly redeem a badge.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p className="text-sm">
            Powered by FHEVM • Privacy-First • Fully Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}


