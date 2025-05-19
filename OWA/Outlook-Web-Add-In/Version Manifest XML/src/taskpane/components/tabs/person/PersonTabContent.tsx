// src/taskpane/components/PersonsAccordion.tsx
import React from 'react';

// Person data shape
export interface Person {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// Props for the accordion
interface Props {
  persons: Person[];
  loading?: boolean;
  onDeleteFavorite: (id: string) => void;
  onAddFavorite:    (id: string) => void;
}

const PersonsTabContent: React.FC<Props> = ({
  persons,
  loading = false,
  onDeleteFavorite,
  onAddFavorite
}) => {
  return (
    <div style={{
      maxWidth: 400,
      margin: '0 auto',
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        fontSize: 18,
        fontWeight: 600,
        color: '#4a5568'
      }}>
        Persons
        <span className="material-icons" style={{ marginLeft: 8, fontSize: 20, color: '#4a5568' }}>
          star
        </span>
        {loading && (
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a0aec0' }}>
            Loading…
          </span>
        )}
      </div>

      {persons.map((p, idx) => {
        const isFirst = idx === 0;
        return (
          <details
            key={p.id}
            open={isFirst}
            style={{
              borderTop: idx > 0 ? '1px solid #e2e8f0' : 'none'
            }}
            className="person-panel"
          >
            <summary style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 14,
              color: '#2d3748'
            }}>
              <span style={{
                width: 20,
                textAlign: 'center',
                fontWeight: 600,
                color: '#a0aec0'
              }}>
                {isFirst ? '−' : '+'}
              </span>
              <span className="material-icons" style={{
                fontSize: 20,
                color: '#a0aec0',
                marginRight: 8
              }}>
                person
              </span>
              <span style={{ flexGrow: 1, fontWeight: 500 }}>
                {p.name}
              </span>
              {isFirst
                ? <button
                    onClick={() => onDeleteFavorite(p.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a0aec0',
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >Delete from favorite</button>
                : <button
                    onClick={() => onAddFavorite(p.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a0aec0',
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >Delete from favorite</button>
              }
            </summary>

            <div style={{ padding: '0 16px 12px 44px', fontSize: 14, color: '#4a5568', lineHeight: 1.4 }}>
              {p.address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#a0aec0', marginRight: 8 }}>home</span>
                  <div>
                    <strong>Adress:</strong> {p.address}
                  </div>
                </div>
              )}
              {p.phone && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#a0aec0', marginRight: 8 }}>call</span>
                  <div><strong>Telefon:</strong> {p.phone}</div>
                </div>
              )}
              {p.email && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#a0aec0', marginRight: 8 }}>email</span>
                  <div><strong>Email:</strong> {p.email}</div>
                </div>
              )}
              {p.website && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="material-icons" style={{ fontSize: 18, color: '#a0aec0', marginRight: 8 }}>language</span>
                  <div><strong>Website:</strong> <a href={p.website} target="_blank" rel="noopener noreferrer">{p.website}</a></div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default PersonsTabContent;
