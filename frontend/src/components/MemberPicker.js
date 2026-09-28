import React, { useState, useEffect } from 'react';
import api from '../services/api';
import UserPhoto from './UserPhoto';

const MIN_QUERY_LENGTH = 2;

// Lets the user pick people from their contacts (people they share a group
// with) or search all users by name / exact email. onSelect(user) may be
// async; return false from it to keep the search text (e.g. on failure).
const MemberPicker = ({ excludeIds = [], onSelect, autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectingId, setSelectingId] = useState(null);

  useEffect(() => {
    api.get('/api/users/contacts')
      .then(response => setContacts(response.data))
      .catch(err => console.error('Failed to load contacts:', err));
  }, []);

  // Debounced search against all users
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/api/users/search', { params: { q } });
        setSearchResults(response.data);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (user) => {
    setSelectingId(user.id);
    try {
      const result = await onSelect(user);
      if (result !== false) setQuery('');
    } finally {
      setSelectingId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const isSearching = q.length >= MIN_QUERY_LENGTH;
  const notExcluded = user => !excludeIds.includes(user.id);

  // While typing, filter contacts locally and append site-wide results
  // that aren't already contacts
  const matchingContacts = contacts
    .filter(notExcluded)
    .filter(c => !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  const contactIds = new Set(contacts.map(c => c.id));
  const otherResults = isSearching
    ? searchResults.filter(notExcluded).filter(u => !contactIds.has(u.id))
    : [];

  const renderUser = (user) => (
    <li key={user.id} className="add-member-option">
      <UserPhoto user={user} />
      <div className="add-member-option-info">
        <span className="add-member-option-name">{user.name}</span>
        <span className="add-member-option-meta">
          {user.email}
          {user.sharedGroups ? ` · ${user.sharedGroups} shared group${user.sharedGroups > 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={() => handleSelect(user)}
        disabled={selectingId !== null}
        className="btn btn-primary btn-small"
      >
        {selectingId === user.id ? 'Adding...' : 'Add'}
      </button>
    </li>
  );

  return (
    <div className="member-picker">
      <div className="form-group">
        <label htmlFor="memberSearch">Search by name or email</label>
        <input
          type="text"
          id="memberSearch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Enter would otherwise submit a surrounding form (e.g. Create Group)
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="e.g. Alice, or alice@example.com"
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <small className="form-help">
          Email search needs the full address. The person must already have an account.
        </small>
      </div>

      {matchingContacts.length > 0 && (
        <>
          <div className="add-member-section-title">
            {q ? 'People you know' : 'People from your other groups'}
          </div>
          <ul className="add-member-options">{matchingContacts.map(renderUser)}</ul>
        </>
      )}

      {otherResults.length > 0 && (
        <>
          <div className="add-member-section-title">Other users</div>
          <ul className="add-member-options">{otherResults.map(renderUser)}</ul>
        </>
      )}

      {isSearching && searching && otherResults.length === 0 && (
        <div className="add-member-empty">Searching...</div>
      )}

      {isSearching && !searching && matchingContacts.length === 0 && otherResults.length === 0 && (
        <div className="add-member-empty">No users found for "{query.trim()}"</div>
      )}
    </div>
  );
};

export default MemberPicker;
