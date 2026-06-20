"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { DEFAULT_DELAY_OPTIONS } from "@/lib/seedData";
import {
  getFavoriteRegistryUserIds,
  listRegistryUsers,
  toggleFavoriteRegistryUser,
  updateUserSettings,
} from "@/lib/registryService";
import type { RegistryUser, UserSettings } from "@/lib/types";

const REGISTRY_SECTIONS = [
  { id: "settings", label: "My Settings", icon: "/design-assets/Seal.png" },
  { id: "public", label: "Public Listings", icon: "/design-assets/Open Book.png" },
  { id: "favorites", label: "Favorites", icon: "/design-assets/Parchment Stamp.png" },
] as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FINAL_REGISTRY_LETTER = ALPHABET[ALPHABET.length - 1];
const TOTAL_REGISTRY_SPREADS = 2 + Math.ceil((ALPHABET.length - 2) / 2);
const LAST_SPREAD_INDEX = TOTAL_REGISTRY_SPREADS - 1;

type RegistrySectionId = (typeof REGISTRY_SECTIONS)[number]["id"];
type RegistrySpreadPage =
  | { kind: "settings" }
  | { kind: "letter"; letter: string }
  | { kind: "favorites" }
  | { kind: "blank" };

const REFERENCE_A_LISTINGS: RegistryUser[] = [
  { id: "ref-a-habbott", firstName: "Hannah", lastName: "Abbott", mailboxName: "habbott", includedInRegistry: true },
  { id: "ref-a-earcher", firstName: "Emilia", lastName: "Archer", mailboxName: "earcher", includedInRegistry: true },
  { id: "ref-a-jashby", firstName: "Jonah", lastName: "Ashby", mailboxName: "jashby", includedInRegistry: true },
  { id: "ref-a-cavery", firstName: "Clara", lastName: "Avery", mailboxName: "cavery", includedInRegistry: true },
];

function fullName(user: RegistryUser) {
  return `${user.firstName} ${user.lastName}`.trim() || `@${user.mailboxName}`;
}

function registryLetter(user: RegistryUser) {
  return (user.lastName?.[0] ?? user.firstName?.[0] ?? "#").toUpperCase();
}

function sectionForSpread(spreadIndex: number): RegistrySectionId {
  if (spreadIndex === 0) {
    return "settings";
  }

  if (spreadIndex === LAST_SPREAD_INDEX) {
    return "favorites";
  }

  return "public";
}

function getSpreadIndexForLetterIndex(letterIndex: number) {
  if (letterIndex <= 0) {
    return 0;
  }

  if (letterIndex === ALPHABET.length - 1) {
    return LAST_SPREAD_INDEX;
  }

  return 1 + Math.floor((letterIndex - 1) / 2);
}

function getSpreadPages(spreadIndex: number): { left: RegistrySpreadPage; right: RegistrySpreadPage } {
  const clamped = Math.min(LAST_SPREAD_INDEX, Math.max(0, spreadIndex));

  if (clamped === 0) {
    return {
      left: { kind: "settings" },
      right: { kind: "letter", letter: "A" },
    };
  }

  if (clamped === LAST_SPREAD_INDEX) {
    return {
      left: { kind: "letter", letter: FINAL_REGISTRY_LETTER },
      right: { kind: "favorites" },
    };
  }

  const leftIndex = 1 + (clamped - 1) * 2;
  const rightIndex = leftIndex + 1;

  return {
    left: ALPHABET[leftIndex] ? { kind: "letter", letter: ALPHABET[leftIndex] } : { kind: "blank" },
    right: ALPHABET[rightIndex] ? { kind: "letter", letter: ALPHABET[rightIndex] } : { kind: "blank" },
  };
}

function displayedUsersForLetter(letter: string, usersByLetter: Record<string, RegistryUser[]>) {
  const matchingUsers = (usersByLetter[letter] ?? []).slice(0, 4);
  if (matchingUsers.length > 0) {
    return matchingUsers;
  }

  return letter === "A" ? REFERENCE_A_LISTINGS : [];
}

type RegistryDirectoryPageProps = {
  pageClassName: string;
  pageHeading: string;
  centerHeading: string;
  users: RegistryUser[];
  emptyCopy: string;
  footerCopy: string;
  favoriteUserIds: string[];
  currentUserId?: string;
  favoritePendingId: string | null;
  onToggleFavorite: (targetUserId: string) => Promise<void>;
};

function RegistryDirectoryPage({
  pageClassName,
  pageHeading,
  centerHeading,
  users,
  emptyCopy,
  footerCopy,
  favoriteUserIds,
  currentUserId,
  favoritePendingId,
  onToggleFavorite,
}: RegistryDirectoryPageProps) {
  return (
    <div className={`registry-book-page ${pageClassName}`}>
      <div className="registry-book-page-heading">{pageHeading}</div>
      <div className="desk-ornament-divider registry-book-divider" aria-hidden="true">
        <span className="desk-ornament-mark" />
      </div>

      <div className={`registry-letter-heading ${centerHeading.length > 1 ? "registry-letter-heading-wide" : ""}`}>
        <span>{centerHeading}</span>
      </div>

      <div className="registry-letter-rule" aria-hidden="true" />

      <div className="registry-listings">
        {users.length > 0 ? (
          users.map((user) => {
            const isFavorite = favoriteUserIds.includes(user.id);
            const isReferenceEntry = user.id.startsWith("ref-");
            const canFavorite = !isReferenceEntry && currentUserId !== user.id;

            return (
              <div key={user.id} className="registry-listing-row">
                <span className="registry-listing-name">{fullName(user)}</span>
                <span className="registry-listing-mailbox">@{user.mailboxName}</span>
                <div className="registry-listing-actions">
                  {isReferenceEntry ? (
                    <span className="registry-listing-write registry-listing-write-static">Sample</span>
                  ) : (
                    <Link href={`/desk?composeTo=${encodeURIComponent(user.mailboxName)}`} className="registry-listing-write">
                      <Image
                        src="/design-assets/Simple Feather.png"
                        alt=""
                        width={16}
                        height={16}
                        className="registry-listing-write-icon"
                      />
                      Write
                    </Link>
                  )}
                  {canFavorite ? (
                    <button
                      type="button"
                      className={`registry-favorite-button ${isFavorite ? "registry-favorite-button-active" : ""}`}
                      onClick={() => void onToggleFavorite(user.id)}
                      disabled={favoritePendingId === user.id}
                      aria-label={isFavorite ? `Remove ${fullName(user)} from favorites` : `Add ${fullName(user)} to favorites`}
                      title={isFavorite ? "Remove favorite" : "Add favorite"}
                    >
                      {isFavorite ? "Saved" : "Save"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="registry-listing-empty">
            {emptyCopy}
          </div>
        )}
      </div>

      <p className="registry-book-footer-copy">{footerCopy}</p>
    </div>
  );
}

export default function RegistryPage() {
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [registryUsers, setRegistryUsers] = useState<RegistryUser[]>([]);
  const [favoriteUserIds, setFavoriteUserIds] = useState<string[]>([]);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<RegistrySectionId>("settings");
  const [isSaving, setSaving] = useState(false);
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setSettings(profile.settings);
    void (async () => {
      const [users, favorites] = await Promise.all([
        listRegistryUsers(),
        getFavoriteRegistryUserIds(profile.uid),
      ]);
      setRegistryUsers(users);
      setFavoriteUserIds(favorites);
    })();
  }, [profile]);

  const usersByLetter = useMemo(() => {
    return registryUsers.reduce<Record<string, RegistryUser[]>>((groups, user) => {
      const letter = registryLetter(user);
      groups[letter] ??= [];
      groups[letter].push(user);
      return groups;
    }, {});
  }, [registryUsers]);

  const currentSpread = useMemo(() => getSpreadPages(currentSpreadIndex), [currentSpreadIndex]);

  const visibleLetters = [
    currentSpread.left.kind === "letter" ? currentSpread.left.letter : null,
    currentSpread.right.kind === "letter" ? currentSpread.right.letter : null,
  ].filter((letter): letter is string => Boolean(letter));

  const favoriteUsers = useMemo(() => {
    const favoritesLookup = new Set(favoriteUserIds);
    return registryUsers.filter((user) => favoritesLookup.has(user.id));
  }, [favoriteUserIds, registryUsers]);

  const mobileRegistryUsers = useMemo(() => {
    return registryUsers.length > 0 ? registryUsers : REFERENCE_A_LISTINGS;
  }, [registryUsers]);

  const mobileRegistryResults = useMemo(() => {
    const normalizedQuery = mobileSearchQuery.trim().toLowerCase();
    const base = mobileRegistryUsers.filter((user) => user.includedInRegistry !== false);

    if (!normalizedQuery) {
      return base.slice(0, 12);
    }

    return base.filter((user) => {
      const haystack = `${user.firstName} ${user.lastName} ${user.mailboxName}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [mobileRegistryUsers, mobileSearchQuery]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  async function refreshRegistryUsers() {
    setRegistryUsers(await listRegistryUsers());
  }

  async function handleSave() {
    if (!profile || !settings) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await updateUserSettings(profile.uid, settings);
      await refreshProfile();
      await refreshRegistryUsers();
      setStatusMessage("Your address has been updated.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error ? caughtError.message : "We could not update your address.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyAddress() {
    if (!settings) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`@${settings.mailboxName}`);
      setStatusMessage(`Copied @${settings.mailboxName}`);
      setErrorMessage(null);
    } catch {
      setErrorMessage("We could not copy your address.");
    }
  }

  async function handleToggleFavorite(targetUserId: string) {
    if (!profile || targetUserId === profile.uid) {
      return;
    }

    const wasFavorite = favoriteUserIds.includes(targetUserId);
    setFavoritePendingId(targetUserId);
    setErrorMessage(null);

    try {
      const nextFavorites = await toggleFavoriteRegistryUser(profile.uid, targetUserId);
      setFavoriteUserIds(nextFavorites);
      setStatusMessage(wasFavorite ? "Removed from favorites." : "Added to favorites.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error ? caughtError.message : "We could not update favorites.",
      );
    } finally {
      setFavoritePendingId(null);
    }
  }

  function handleReset() {
    if (!profile) {
      return;
    }

    setSettings(profile.settings);
    setErrorMessage(null);
    setStatusMessage("Changes reset.");
  }

  function goToSpread(index: number, sectionOverride?: RegistrySectionId) {
    const clamped = Math.min(LAST_SPREAD_INDEX, Math.max(0, index));
    setCurrentSpreadIndex(clamped);
    setActiveSection(sectionOverride ?? sectionForSpread(clamped));
  }

  function goToLetter(letter: string) {
    const letterIndex = ALPHABET.indexOf(letter);
    if (letterIndex === -1) {
      return;
    }

    goToSpread(getSpreadIndexForLetterIndex(letterIndex), "public");
  }

  function goToFavoritesPage() {
    goToSpread(LAST_SPREAD_INDEX, "favorites");
  }

  function handleSectionSelect(sectionId: RegistrySectionId) {
    setErrorMessage(null);

    if (sectionId === "settings") {
      goToSpread(0, sectionId);
      return;
    }

    if (sectionId === "public") {
      goToLetter("A");
      return;
    }

    if (sectionId === "favorites") {
      goToFavoritesPage();
    }
  }

  if (!settings) {
    return (
      <section className="app-card">
        <p className="eyebrow">Registry</p>
        <p className="mt-3 text-[var(--color-text-soft)]">Loading registry...</p>
      </section>
    );
  }

  return (
    <section className="desk-workspace registry-workspace">
      <div className="desk-ornament-divider registry-nav-divider" aria-hidden="true">
        <span className="desk-ornament-mark" />
      </div>

      <section className="scene-mobile-only registry-mobile-shell">
        <div className="mobile-scene-card">
          <div className="mobile-scene-heading-row">
            <div>
              <p className="mobile-scene-eyebrow">Registry</p>
              <h2 className="mobile-scene-title">Find</h2>
            </div>
            <button type="button" className="secondary-button mobile-scene-button" onClick={() => void handleCopyAddress()}>
              Copy Address
            </button>
          </div>

          <div className="mobile-scene-note">
            <span>Your address</span>
            <strong>@{settings.mailboxName}</strong>
          </div>

          <label className="mobile-scene-field">
            <span>Search people</span>
            <input
              value={mobileSearchQuery}
              onChange={(event) => setMobileSearchQuery(event.target.value)}
              className="paper-input"
              placeholder="Search name or mailbox"
            />
          </label>

          {statusMessage ? <p className="registry-side-notice registry-side-notice-success">{statusMessage}</p> : null}
          {errorMessage ? <p className="registry-side-notice registry-side-notice-error">{errorMessage}</p> : null}
        </div>

        <div className="registry-mobile-results">
          {mobileRegistryResults.length > 0 ? (
            mobileRegistryResults.map((user) => (
              <div key={user.id} className="registry-mobile-result">
                <div>
                  <p className="registry-mobile-result-name">{fullName(user)}</p>
                  <p className="registry-mobile-result-mailbox">@{user.mailboxName}</p>
                </div>
                {user.id.startsWith("ref-") ? (
                  <span className="registry-mobile-result-static">Sample</span>
                ) : (
                  <Link href={`/desk?composeTo=${encodeURIComponent(user.mailboxName)}`} className="secondary-button registry-mobile-write">
                    Write
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="mobile-scene-empty">No matches found.</div>
          )}
        </div>
      </section>

      <div className="registry-page-grid scene-desktop-only">
        <aside className="registry-left-rail">
          <div className="registry-left-stack">
            <section className="registry-left-intro">
              <div className="flex items-start justify-between gap-3">
                <div className="registry-left-heading-block">
                  <p className="desk-rail-title">Registry</p>
                  <h2 className="registry-left-heading">Sections</h2>
                  <p className="registry-left-copy">
                    Set your public address and browse the book of correspondents.
                  </p>
                </div>
                <Image
                  src="/design-assets/Leaf 8.png"
                  alt=""
                  width={88}
                  height={132}
                  className="registry-left-botanical"
                />
              </div>
            </section>

            <div className="registry-section-list">
              {REGISTRY_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionSelect(section.id)}
                  className={`registry-section-card ${activeSection === section.id ? "registry-section-card-active" : ""}`}
                >
                  <div className="registry-section-card-main">
                    <Image
                      src={section.icon}
                      alt=""
                      width={36}
                      height={36}
                      className="registry-section-icon"
                    />
                    <span className="registry-section-title">{section.label}</span>
                  </div>
                  {activeSection === section.id ? <span className="registry-section-dot" /> : null}
                </button>
              ))}
            </div>

            <section className="registry-left-note">
              <Image src="/design-assets/Lock.png" alt="" width={28} height={28} className="registry-left-note-icon" />
              <p>
                Only users who choose to appear are shown in the public Registry.
              </p>
            </section>
          </div>

          <section className="registry-left-quote">
            <Image
              src="/design-assets/Flower Stamp 3.png"
              alt=""
              width={72}
              height={140}
              className="registry-left-quote-floral"
            />
            <div className="desk-quote-divider registry-quote-divider" aria-hidden="true" />
            <p className="font-fountain text-[1.15rem] leading-tight text-[var(--color-text-soft)]">
              To be found is a choice,
            </p>
            <p className="mt-1 font-fountain text-[1.15rem] leading-tight text-[var(--color-text-soft)]">
              not an accident.
            </p>
            <p className="mt-1 font-fountain text-[1rem] leading-tight text-[var(--color-text-soft)]">&mdash; P.</p>
          </section>
        </aside>

        <section className="registry-center-panel">
          <div className="registry-header-row">
            <div className="registry-header-copy">
              <h2 className="registry-center-heading">Registry</h2>
              <p className="registry-center-copy">
                Manage your address, visibility, and the people who choose to be found.
              </p>
            </div>
            <div className="desk-ornament-divider registry-header-divider" aria-hidden="true">
              <span className="desk-ornament-mark" />
            </div>
          </div>

          <div className="registry-book-stage">
            <div className="registry-book-stack" aria-hidden="true">
              <div className="registry-book-layer registry-book-layer-back" />
              <div className="registry-book-layer registry-book-layer-mid" />
              <div className="registry-book-layer registry-book-layer-front" />
              <div className="registry-book-spine-line" />
            </div>

            <button type="button" className="registry-book-side-tab" onClick={() => goToSpread(0, "settings")}>
              <span className="registry-book-side-tab-mark" aria-hidden="true">*</span>
              <span className="sr-only">Open settings page</span>
            </button>

            <div className="registry-book-overlay">
              {currentSpread.left.kind === "settings" ? (
                <div className="registry-book-page registry-book-page-left registry-book-page-settings">
                  <div className="registry-book-page-heading">Your Address</div>
                  <div className="desk-ornament-divider registry-book-divider" aria-hidden="true">
                    <span className="desk-ornament-mark" />
                  </div>

                  <div className="registry-book-form-grid">
                    <label className="registry-book-field">
                      <span className="registry-label">First Name</span>
                      <input
                        className="paper-input registry-book-input"
                        value={settings.firstName}
                        onChange={(event) =>
                          setSettings((current) => (current ? { ...current, firstName: event.target.value } : current))
                        }
                      />
                    </label>
                    <label className="registry-book-field">
                      <span className="registry-label">Last Name</span>
                      <input
                        className="paper-input registry-book-input"
                        value={settings.lastName}
                        onChange={(event) =>
                          setSettings((current) => (current ? { ...current, lastName: event.target.value } : current))
                        }
                      />
                    </label>
                    <label className="registry-book-field">
                      <span className="registry-label">Mailbox Name</span>
                      <input
                        className="paper-input registry-book-input"
                        value={settings.mailboxName}
                        onChange={(event) =>
                          setSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  mailboxName: event.target.value.toLowerCase().replace(/\s+/g, ""),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label className="registry-book-field">
                      <span className="registry-label">Address Preview</span>
                      <input
                        className="paper-input registry-book-input"
                        value={`@${settings.mailboxName}`}
                        readOnly
                      />
                    </label>
                  </div>

                  <div className="registry-book-availability-row">
                    <div>
                      <p className="registry-label">Availability</p>
                      <div className="registry-availability-value">
                        <span className="registry-availability-dot" />
                        <span>Available</span>
                      </div>
                    </div>
                  </div>

                  <div className="registry-book-toggle-row">
                    <div>
                      <p className="registry-book-toggle-title">Include me in Registry</p>
                      <p className="registry-book-toggle-copy">
                        When enabled, others can find your name and mailbox address in the Registry.
                      </p>
                    </div>
                    <label className="registry-switch">
                      <input
                        type="checkbox"
                        checked={settings.includeInRegistry}
                        onChange={(event) =>
                          setSettings((current) =>
                            current ? { ...current, includeInRegistry: event.target.checked } : current,
                          )
                        }
                      />
                      <span className="registry-switch-slider" />
                    </label>
                  </div>

                  <div className="desk-ornament-divider registry-book-inline-divider" aria-hidden="true">
                    <span className="desk-ornament-mark" />
                  </div>

                  <div className="registry-book-form-grid">
                    <label className="registry-book-field">
                      <span className="registry-label">Outgoing Delay</span>
                      <select
                        className="paper-select registry-book-input"
                        value={settings.outgoingDelayDays}
                        onChange={(event) =>
                          setSettings((current) =>
                            current ? { ...current, outgoingDelayDays: Number(event.target.value) } : current,
                          )
                        }
                      >
                        {DEFAULT_DELAY_OPTIONS.map((delay) => (
                          <option key={`out-${delay}`} value={delay}>
                            {delay} day{delay === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="registry-book-field">
                      <span className="registry-label">Incoming Delay</span>
                      <select
                        className="paper-select registry-book-input"
                        value={settings.incomingDelayDays}
                        onChange={(event) =>
                          setSettings((current) =>
                            current ? { ...current, incomingDelayDays: Number(event.target.value) } : current,
                          )
                        }
                      >
                        {DEFAULT_DELAY_OPTIONS.map((delay) => (
                          <option key={`in-${delay}`} value={delay}>
                            {delay} day{delay === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="registry-book-button-row">
                    <button type="button" className="paper-button registry-save-button" disabled={isSaving} onClick={() => void handleSave()}>
                      {isSaving ? "Saving..." : "Save to Registry"}
                      <Image src="/design-assets/Seal.png" alt="" width={26} height={26} className="registry-save-seal" />
                    </button>
                    <button type="button" className="secondary-button registry-reset-button" onClick={handleReset}>
                      Reset Changes
                    </button>
                  </div>

                  {statusMessage ? <p className="registry-book-status registry-book-status-success">{statusMessage}</p> : null}
                  {errorMessage ? <p className="registry-book-status registry-book-status-error">{errorMessage}</p> : null}

                  <div className="registry-book-note">
                    <Image src="/design-assets/Leaf 1.png" alt="" width={32} height={32} className="registry-book-note-icon" />
                    <p>
                      Mailbox names must be unique, contain no spaces,
                      and use allowed characters only.
                    </p>
                  </div>
                </div>
              ) : currentSpread.left.kind === "letter" ? (
                <RegistryDirectoryPage
                  pageClassName="registry-book-page-left"
                  pageHeading="Public Registry"
                  centerHeading={currentSpread.left.letter}
                  users={displayedUsersForLetter(currentSpread.left.letter, usersByLetter)}
                  emptyCopy={`No public listings for ${currentSpread.left.letter} yet.`}
                  footerCopy="Only visible members are included in the Registry."
                  favoriteUserIds={favoriteUserIds}
                  currentUserId={profile?.uid}
                  favoritePendingId={favoritePendingId}
                  onToggleFavorite={handleToggleFavorite}
                />
              ) : (
                <div className="registry-book-page registry-book-page-left registry-book-page-blank" />
              )}

              {currentSpread.right.kind === "letter" ? (
                <RegistryDirectoryPage
                  pageClassName="registry-book-page-right"
                  pageHeading="Public Registry"
                  centerHeading={currentSpread.right.letter}
                  users={displayedUsersForLetter(currentSpread.right.letter, usersByLetter)}
                  emptyCopy={`No public listings for ${currentSpread.right.letter} yet.`}
                  footerCopy="Only visible members are included in the Registry."
                  favoriteUserIds={favoriteUserIds}
                  currentUserId={profile?.uid}
                  favoritePendingId={favoritePendingId}
                  onToggleFavorite={handleToggleFavorite}
                />
              ) : currentSpread.right.kind === "favorites" ? (
                <RegistryDirectoryPage
                  pageClassName="registry-book-page-right"
                  pageHeading="Registry Keepsakes"
                  centerHeading="Favorites"
                  users={favoriteUsers}
                  emptyCopy="Star a few addresses as you browse and they will gather here."
                  footerCopy="Favorites are saved to your personal Registry."
                  favoriteUserIds={favoriteUserIds}
                  currentUserId={profile?.uid}
                  favoritePendingId={favoritePendingId}
                  onToggleFavorite={handleToggleFavorite}
                />
              ) : (
                <div className="registry-book-page registry-book-page-right registry-book-page-blank">
                  <div className="registry-book-page-heading">Registry</div>
                  <div className="desk-ornament-divider registry-book-divider" aria-hidden="true">
                    <span className="desk-ornament-mark" />
                  </div>
                  <div className="registry-listing-empty">End of listings.</div>
                </div>
              )}
            </div>

            <div className="registry-alphabet-tabs" aria-label="Registry letters">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={`registry-alphabet-tab ${visibleLetters.includes(letter) ? "registry-alphabet-tab-active" : ""}`}
                  onClick={() => goToLetter(letter)}
                  aria-label={`Jump to ${letter}`}
                >
                  <span>{letter}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="registry-page-controls">
            <button type="button" className="registry-page-button" onClick={() => goToSpread(0)} disabled={currentSpreadIndex === 0}>
              &laquo;
            </button>
            <button type="button" className="registry-page-button" onClick={() => goToSpread(currentSpreadIndex - 1)} disabled={currentSpreadIndex === 0}>
              &lsaquo;
            </button>
            <div className="registry-page-indicator">
              <span>Page {currentSpreadIndex + 1} of {TOTAL_REGISTRY_SPREADS}</span>
              <div className="desk-ornament-divider registry-page-indicator-divider" aria-hidden="true">
                <span className="desk-ornament-mark" />
              </div>
            </div>
            <button type="button" className="registry-page-button" onClick={() => goToSpread(currentSpreadIndex + 1)} disabled={currentSpreadIndex === LAST_SPREAD_INDEX}>
              &rsaquo;
            </button>
            <button type="button" className="registry-page-button" onClick={() => goToSpread(LAST_SPREAD_INDEX)} disabled={currentSpreadIndex === LAST_SPREAD_INDEX}>
              &raquo;
            </button>
          </div>
        </section>

        <aside className="desk-card registry-right-panel">
          <section>
            <h3 className="desk-panel-heading">Actions</h3>
            <div className="desk-ornament-divider desk-ornament-divider-compact" aria-hidden="true">
              <span className="desk-ornament-mark" />
            </div>

            <div className="desk-action-stack">
              <button type="button" onClick={() => void handleSave()} className="desk-action-button" disabled={isSaving}>
                <Image src="/design-assets/Seal.png" alt="" width={48} height={48} className="desk-action-icon" />
                <div>
                  <p className="desk-action-title">Save to Registry</p>
                  <p className="desk-action-copy">Update your settings</p>
                </div>
              </button>

              <button type="button" onClick={() => goToLetter("A")} className="desk-action-button">
                <Image src="/design-assets/Parchment Stamp 2.png" alt="" width={48} height={48} className="desk-action-icon" />
                <div>
                  <p className="desk-action-title">View Public Listings</p>
                  <p className="desk-action-copy">Browse the Registry book</p>
                </div>
              </button>

              <button type="button" onClick={() => void handleCopyAddress()} className="desk-action-button">
                <Image src="/design-assets/Ticket with Flower.png" alt="" width={48} height={48} className="desk-action-icon" />
                <div>
                  <p className="desk-action-title">Copy Address</p>
                  <p className="desk-action-copy">Copy @{settings.mailboxName}</p>
                </div>
              </button>

              <Link href="/desk?openNew=1" className="desk-action-button">
                <Image src="/design-assets/Complex Feather.png" alt="" width={48} height={48} className="desk-action-icon" />
                <div>
                  <p className="desk-action-title">Write Letter</p>
                  <p className="desk-action-copy">Compose to a contact</p>
                </div>
              </Link>
            </div>

            {statusMessage ? <p className="registry-side-notice registry-side-notice-success">{statusMessage}</p> : null}
            {errorMessage ? <p className="registry-side-notice registry-side-notice-error">{errorMessage}</p> : null}
          </section>

          <section className="desk-panel-section">
            <div className="desk-panel-label">Registry Status</div>
            <div className="desk-summary-card registry-status-card">
              <Image
                src="/design-assets/Leaf 8.png"
                alt=""
                width={90}
                height={120}
                className="desk-summary-sprig"
              />
              <div className="registry-status-rows">
                <div className="registry-status-row">
                  <Image src="/design-assets/Seal.png" alt="" width={18} height={18} className="registry-status-icon" />
                  <span>Visibility</span>
                  <span className="registry-status-value">
                    {settings.includeInRegistry ? "Included in Registry" : "Private"}
                    <span className={`registry-status-dot ${settings.includeInRegistry ? "registry-status-dot-active" : ""}`} />
                  </span>
                </div>
                <div className="registry-status-row">
                  <Image src="/design-assets/Letter.png" alt="" width={18} height={18} className="registry-status-icon" />
                  <span>Mailbox Address</span>
                  <span className="text-[var(--color-text-strong)]">@{settings.mailboxName}</span>
                </div>
                <div className="registry-status-row">
                  <Image src="/design-assets/Parchment Stamp.png" alt="" width={18} height={18} className="registry-status-icon" />
                  <span>Favorites</span>
                  <span className="text-[var(--color-text-strong)]">{favoriteUsers.length} saved</span>
                </div>
                <div className="registry-status-row">
                  <Image src="/design-assets/Stamp.png" alt="" width={18} height={18} className="registry-status-icon" />
                  <span>Outgoing Delay</span>
                  <span className="text-[var(--color-text-strong)]">{settings.outgoingDelayDays} days</span>
                </div>
                <div className="registry-status-row">
                  <Image src="/design-assets/Open Book.png" alt="" width={18} height={18} className="registry-status-icon" />
                  <span>Page</span>
                  <span className="text-[var(--color-text-strong)]">{currentSpreadIndex + 1} of {TOTAL_REGISTRY_SPREADS}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="desk-guidance-card registry-guidance-card">
            <Image src="/design-assets/Flower Stamp.png" alt="" width={44} height={44} className="h-10 w-10 object-contain" />
            <div>
              <p className="desk-panel-label mb-1">Guidance</p>
              <p className="text-[0.78rem] leading-5 text-[var(--color-text-soft)]">
                Star the people you would like to find again. Your favorites wait on the very last page.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
