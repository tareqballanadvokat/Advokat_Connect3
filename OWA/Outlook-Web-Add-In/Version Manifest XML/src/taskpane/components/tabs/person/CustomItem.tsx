import React from 'react'; 

 
export default function CustomItem(p) {
  return (
 <div>
    
      <div key={p.id} style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>{p.name}</div>
        {p.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="dx-icon dx-icon-home" />
            {p.address}
          </div>
        )}
        {p.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="dx-icon dx-icon-bell" />
            {p.phone} 
          </div>
        )}
        {p.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="dx-icon dx-icon-email" />
            {p.email}
          </div>
        )}
        {p.website && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="dx-icon dx-icon-globe" />
            <a href={p.website} target="_blank" rel="noopener noreferrer">
              {p.website}
            </a>
          </div>
        )}
      </div>
    
  </div>
  );
}
