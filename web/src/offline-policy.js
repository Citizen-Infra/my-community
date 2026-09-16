export function canUseNetworkAction(online, action = 'read-cache') {
  if (action === 'read-cache') return true;
  return online === true;
}
