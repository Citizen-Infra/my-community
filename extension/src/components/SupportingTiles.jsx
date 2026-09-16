import { selectedCommunities } from '../store/communities';
import { caMemberships } from '../store/caAuth';
import { jamRooms } from '../store/jam';
import { visibleSupportingTileKeys } from '../store/supporting';
import { openDashboardWorkspace } from '../store/panels';

function externalTile(key, eyebrow, title, detail, href) {
  return { key, eyebrow, title, detail, href };
}

function availableTiles() {
  const communities = selectedCommunities.value;
  const visible = new Set(visibleSupportingTileKeys.value);
  const tiles = [];
  const featured = communities.find((community) => community.featured?.url || community.featured_url);
  if (visible.has('featured') && featured) {
    tiles.push(externalTile(
      'featured',
      featured.name,
      featured.featured?.title || featured.featured_title || 'Featured by your community',
      featured.featured?.description || featured.featured_description || 'A timely place to begin.',
      featured.featured?.url || featured.featured_url,
    ));
  }
  const collective = communities.find((community) => community.open_collective_url || community.openCollectiveUrl);
  if (visible.has('openCollective') && collective) {
    tiles.push(externalTile(
      'openCollective',
      collective.name,
      'Support the shared work',
      'See the community budget and contribute through Open Collective.',
      collective.open_collective_url || collective.openCollectiveUrl,
    ));
  }
  const adminIds = new Set(caMemberships.value.filter((membership) => membership.role === 'admin').map((membership) => membership.community_id));
  const stewardCommunities = communities.filter((community) => adminIds.has(community.id));
  if (visible.has('stewardship') && stewardCommunities.length) {
    tiles.push({
      key: 'stewardship',
      eyebrow: stewardCommunities.length === 1 ? stewardCommunities[0].name : `${stewardCommunities.length} communities`,
      title: 'Stewardship',
      detail: 'Member and community work that needs an administrator’s attention.',
      workspace: 'stewardship',
    });
  }
  if (visible.has('jam') && jamRooms.value.length) {
    tiles.push({
      key: 'jam',
      eyebrow: 'Live now',
      title: jamRooms.value[0].hostName ? `${jamRooms.value[0].hostName} is listening` : 'Community listening room',
      detail: `${jamRooms.value.length} shared listening ${jamRooms.value.length === 1 ? 'room' : 'rooms'} open now.`,
      href: jamRooms.value.length > 1 ? 'https://jam.zhgnv.com/' : `https://jam.zhgnv.com/room/${jamRooms.value[0].id}`,
    });
  }
  return tiles;
}

export function SupportingTiles() {
  const tiles = availableTiles();
  if (!tiles.length) return null;
  return (
    <aside class="dashboard-supporting" aria-label="Connected community spaces">
      {tiles.map((tile) => {
        const content = (
          <>
            <span class="dashboard-supporting-eyebrow">{tile.eyebrow}</span>
            <strong>{tile.title}</strong>
            <span>{tile.detail}</span>
          </>
        );
        return tile.workspace ? (
          <button key={tile.key} type="button" class="dashboard-supporting-tile" onClick={() => openDashboardWorkspace(tile.workspace)}>
            {content}
          </button>
        ) : (
          <a key={tile.key} class="dashboard-supporting-tile" href={tile.href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        );
      })}
    </aside>
  );
}
