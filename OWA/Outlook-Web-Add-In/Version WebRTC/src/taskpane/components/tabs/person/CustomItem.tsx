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


    // <div>
    //     <div>
    //         <i className="dx-icon dx-icon-user" />
    //         Hello World
    //     </div>

 
    //   <div>
    //     <p>
    //       <b>{data.City} </b>
    //       (<span>{data.State}</span>)
    //     </p>
    //     <p>
    //       <span>{data.Zipcode} </span>
    //       <span>{data.Address}</span>
    //     </p>
    //   </div>
    //   <div>
    //     <p>
    //       Phone: <b>{data.Phone}</b>
    //     </p>
    //     <p>
    //       Fax: <b>{data.Fax}</b>
    //     </p>
    //     <p>
    //       Website: <a href={data.Website} target="_blank">
    //         {data.Website}
    //       </a>
    //     </p>
    //   </div>
    // </div>
  );
}
