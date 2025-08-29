import React from 'react';
import { PersonResponse } from '../../interfaces/IPerson';

export default function CustomItem(data: PersonResponse) {
  return (
    <div style={{ padding: 16 }}>
      {/* Address Section */}
      {data.Adressdaten && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <i className="dx-icon dx-icon-home" style={{ fontSize: 16, marginTop: 2, color: '#666' }} />
          <div>
            <div style={{ fontWeight: 500 }}>Adress</div>
            <div style={{ color: '#f0dcdcff', fontSize: 14 }}>
              {data.Adressdaten.straße && <div>{data.Adressdaten.straße}</div>}
              {(data.Adressdaten.plz || data.Adressdaten.ort) && (
                <div>
                  {data.Adressdaten.plz} {data.Adressdaten.ort}
                  {data.Adressdaten.landeskennzeichenIso2 && `, ${data.Adressdaten.landeskennzeichenIso2}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contacts Section */}
      {data.Kontakte && data.Kontakte.length > 0 && (
        <>
          {data.Kontakte.map((contact, index) => {
            let icon = "dx-icon-info";
            let label = contact.Art;
            
            // Map contact types to appropriate icons
            if (contact.Art?.toLowerCase().includes('telefon') || contact.Art?.toLowerCase().includes('phone')) {
              icon = "dx-icon-tel";
              label = "Telefon";
            } else if (contact.Art?.toLowerCase().includes('email') || contact.Art?.toLowerCase().includes('mail')) {
              icon = "dx-icon-email";
              label = "Email";
            } else if (contact.Art?.toLowerCase().includes('website') || contact.Art?.toLowerCase().includes('web')) {
              icon = "dx-icon-globe";
              label = "Website";
            }

            return (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                <i className={`dx-icon ${icon}`} style={{ fontSize: 16, marginTop: 2, color: '#666' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{label}</div>
                  <div style={{ color: '#f0dcdcff', fontSize: 14 }}>
                    {contact.Art?.toLowerCase().includes('website') ? (
                      <a href={contact.TelefonnummerOderAdresse} target="_blank" rel="noopener noreferrer">
                        {contact.TelefonnummerOderAdresse}
                      </a>
                    ) : (
                      contact.TelefonnummerOderAdresse
                    )}
                    {contact.Bemerkung && (
                      <span style={{ marginLeft: 8, fontStyle: 'italic' }}>({contact.Bemerkung})</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Show a message if no contact data is available */}
      {(!data.Adressdaten && (!data.Kontakte || data.Kontakte.length === 0)) && (
        <div style={{ color: '#999', fontStyle: 'italic', padding: 8 }}>
          No contact information available
        </div>
      )}
    </div>
  );
}
