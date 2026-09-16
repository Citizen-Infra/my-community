import { selectedCommunities } from '../store/communities';
import { caMemberships } from '../store/caAuth';
import { CA_URL } from '../lib/config';

export function StewardshipWorkspace() {
  const adminIds = new Set(caMemberships.value.filter((membership) => membership.role === 'admin').map((membership) => membership.community_id));
  const communities = selectedCommunities.value.filter((community) => adminIds.has(community.id));
  return (
    <main class="stewardship-workspace">
      <header>
        <p class="workspace-kicker">Role-based workspace</p>
        <h3>Stewardship</h3>
        <p>Open the right community administration space without mixing private steward work into member feeds.</p>
      </header>
      <div class="stewardship-list">
        {communities.length === 0 && <p class="stewardship-empty">No selected community currently grants this account an administrator role.</p>}
        {communities.map((community) => (
          <article class="stewardship-community" key={community.id}>
            <div>
              <h4>{community.name}</h4>
              <p>Review membership, invitations, sessions, and publishing settings.</p>
            </div>
            <a href={`${CA_URL}/#/communities/${community.id}`} target="_blank" rel="noopener noreferrer">
              Open admin <span aria-hidden="true">↗</span>
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
