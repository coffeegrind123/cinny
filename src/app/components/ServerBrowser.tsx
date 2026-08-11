import React, { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Text,
  color,
  config,
} from 'folds';

import { Modal500 } from './Modal500';
import { PublicServer, usePublicServers } from '../hooks/usePublicServers';
import { useClientConfig } from '../hooks/useClientConfig';

// How many rows to put in the DOM at once. The directory carries ~1150
// servers; rendering all of them on open costs a visible pause for a list
// nobody scrolls to the end of.
const PAGE_SIZE = 60;

type Filters = {
  openOnly: boolean;
  noCaptcha: boolean;
  noEmail: boolean;
  tor: boolean;
  curated: boolean;
};

const INITIAL_FILTERS: Filters = {
  openOnly: true,
  noCaptcha: false,
  noEmail: false,
  tor: false,
  curated: false,
};

const searchIndex = (s: PublicServer): string =>
  [
    s.name,
    s.clientDomain,
    s.software,
    s.info.description,
    s.info.isp,
    s.info.jurisdiction,
    s.info.languages.join(' '),
    s.info.features.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/**
 * `null` means the upstream lists do not say. A filter for "no captcha" must
 * therefore require an explicit `false`, not merely "not true" — otherwise the
 * ~1075 servers nobody has surveyed would all claim to be captcha-free.
 */
const isFalse = (v: boolean | null): boolean => v === false;
const isTrue = (v: boolean | null): boolean => v === true;

function matches(server: PublicServer, filters: Filters, terms: string[]): boolean {
  if (filters.openOnly && !server.registration.open) return false;
  if (filters.noCaptcha && !isFalse(server.registration.captcha)) return false;
  if (filters.noEmail && !isFalse(server.registration.emailRequired)) return false;
  if (filters.tor && !isTrue(server.privacy.torFriendly)) return false;
  if (filters.curated && !server.sources.includes('joinmatrix')) return false;

  if (terms.length > 0) {
    const hay = searchIndex(server);
    return terms.every((t) => hay.includes(t));
  }
  return true;
}

/** Best-known-first, so the top of an unfiltered list is actually useful. */
function rank(s: PublicServer): number {
  let n = 0;
  if (s.sources.includes('joinmatrix')) n += 8;
  if (s.sources.includes('privacydev')) n += 2;
  if (s.sources.length > 1) n += 2;
  if (s.registration.captcha === false) n += 2;
  if (s.registration.emailRequired === false) n += 2;
  if (s.info.description) n += 1;
  return n;
}

function ServerRow({ server, onPick }: { server: PublicServer; onPick: (name: string) => void }) {
  const { registration: reg, privacy: priv, info } = server;

  const badges: { label: string; tone?: 'good' | 'bad' }[] = [];
  if (server.software) {
    badges.push({ label: server.version ? `${server.software} ${server.version}` : server.software });
  }
  if (!reg.open) badges.push({ label: 'invite only', tone: 'bad' });
  if (isFalse(reg.captcha)) badges.push({ label: 'no captcha', tone: 'good' });
  else if (isTrue(reg.captcha)) badges.push({ label: 'captcha', tone: 'bad' });
  if (isFalse(reg.emailRequired)) badges.push({ label: 'no email', tone: 'good' });
  else if (isTrue(reg.emailRequired)) badges.push({ label: 'email', tone: 'bad' });
  if (isTrue(priv.torFriendly)) badges.push({ label: 'tor', tone: 'good' });
  if (isTrue(priv.cloudflare)) badges.push({ label: 'cloudflare' });
  if (info.jurisdiction) badges.push({ label: info.jurisdiction });

  return (
    <Box
      as="button"
      type="button"
      onClick={() => onPick(server.name)}
      direction="Column"
      gap="100"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        border: `1px solid ${color.Surface.ContainerLine}`,
        background: color.Surface.Container,
        cursor: 'pointer',
      }}
    >
      <Box gap="200" alignItems="Center" justifyContent="SpaceBetween">
        <Text size="T300" truncate>
          <b>{server.name}</b>
        </Text>
        <Icon size="50" src={Icons.ArrowRight} />
      </Box>

      {info.description && (
        <Text size="T200" priority="300" truncate>
          {info.description}
        </Text>
      )}

      {badges.length > 0 && (
        <Box gap="100" wrap="Wrap">
          {badges.map((b) => (
            <Text
              key={b.label}
              as="span"
              size="B300"
              style={{
                padding: `0 ${config.space.S100}`,
                borderRadius: config.radii.R300,
                border: `1px solid ${color.Surface.ContainerLine}`,
                color:
                  b.tone === 'good'
                    ? color.Success.Main
                    : b.tone === 'bad'
                      ? color.Critical.Main
                      : undefined,
              }}
            >
              {b.label}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function ServerBrowser({
  requestClose,
  onSelect,
}: {
  requestClose: () => void;
  onSelect: (server: string) => void;
}) {
  const { publicServersUrl } = useClientConfig();
  const { data, isLoading, error } = usePublicServers(publicServersUrl);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const toggle = (key: keyof Filters) => {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
    setLimit(PAGE_SIZE);
  };

  const results = useMemo(() => {
    if (!data) return [];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.servers
      .filter((s) => matches(s, filters, terms))
      .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
  }, [data, query, filters]);

  const pick = (name: string) => {
    onSelect(name);
    requestClose();
  };

  return (
    <Modal500 requestClose={requestClose}>
      <Box direction="Column" style={{ maxHeight: '80vh' }}>
        <Header size="500" variant="Surface" style={{ padding: `0 ${config.space.S400}` }}>
          <Box grow="Yes" direction="Column">
            <Text size="H4">Choose a homeserver</Text>
          </Box>
          <IconButton size="300" onClick={requestClose} radii="300">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Header>

        <Box
          direction="Column"
          gap="200"
          style={{ padding: config.space.S400, paddingBottom: config.space.S200 }}
        >
          <Input
            size="400"
            variant="Background"
            outlined
            autoFocus
            placeholder="Search by name, software, country, ISP…"
            value={query}
            onChange={(evt) => {
              setQuery(evt.target.value);
              setLimit(PAGE_SIZE);
            }}
            before={<Icon size="200" src={Icons.Search} />}
          />

          <Box gap="100" wrap="Wrap">
            <Chip
              variant={filters.openOnly ? 'Primary' : 'Surface'}
              radii="Pill"
              onClick={() => toggle('openOnly')}
            >
              <Text size="B300">Open registration</Text>
            </Chip>
            <Chip
              variant={filters.curated ? 'Primary' : 'Surface'}
              radii="Pill"
              onClick={() => toggle('curated')}
            >
              <Text size="B300">Has details</Text>
            </Chip>
            <Chip
              variant={filters.noCaptcha ? 'Primary' : 'Surface'}
              radii="Pill"
              onClick={() => toggle('noCaptcha')}
            >
              <Text size="B300">No captcha</Text>
            </Chip>
            <Chip
              variant={filters.noEmail ? 'Primary' : 'Surface'}
              radii="Pill"
              onClick={() => toggle('noEmail')}
            >
              <Text size="B300">No email</Text>
            </Chip>
            <Chip
              variant={filters.tor ? 'Primary' : 'Surface'}
              radii="Pill"
              onClick={() => toggle('tor')}
            >
              <Text size="B300">Tor friendly</Text>
            </Chip>
          </Box>

          {data && (
            <Text size="T200" priority="300">
              {results.length} of {data.servers.length} servers
              {data.degraded && ' · one source was unreachable, showing cached data'}
            </Text>
          )}
        </Box>

        <Box grow="Yes" style={{ minHeight: 0 }}>
          <Scroll hideTrack visibility="Hover">
            <Box
              direction="Column"
              gap="200"
              style={{ padding: config.space.S400, paddingTop: 0 }}
            >
              {isLoading && (
                <Box justifyContent="Center" style={{ padding: config.space.S700 }}>
                  <Spinner variant="Secondary" size="400" />
                </Box>
              )}

              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  Could not load the server directory. Check your connection, or type a homeserver
                  name directly.
                </Text>
              )}

              {!isLoading && !error && results.length === 0 && (
                <Text size="T200" priority="300" align="Center">
                  No servers match those filters.
                </Text>
              )}

              {results.slice(0, limit).map((server) => (
                <ServerRow key={server.name} server={server} onPick={pick} />
              ))}

              {results.length > limit && (
                <Chip
                  variant="Surface"
                  radii="400"
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  style={{ alignSelf: 'center' }}
                >
                  <Text size="B300">Show more ({results.length - limit} remaining)</Text>
                </Chip>
              )}

              <Text size="T200" priority="400" align="Center">
                Merged daily from asra.gr, joinmatrix.org and privacydev.net. Inclusion is not a
                recommendation.
              </Text>
            </Box>
          </Scroll>
        </Box>
      </Box>
    </Modal500>
  );
}
