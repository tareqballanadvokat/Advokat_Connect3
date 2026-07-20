import React from 'react';
import { useTranslation } from 'react-i18next';
import './person.css';
import '../shared/shared.css';

export interface CustomTitleProps {
  personId: number;
  anzeigename: string;
  isDeleting?: boolean;
  onDelete: () => void;
}

export default function CustomTitle({ anzeigename, isDeleting = false, onDelete }: Omit<CustomTitleProps, 'personId'>) {
  const { t: translate } = useTranslation('person');
  return (
    <div
      className='person-title-row'
    >
      {/* Section 1 – name (takes remaining space, truncates) */}
      <div className="person-title-name-section">
        {isDeleting ? (
          <i
            className="dx-icon dx-icon-refresh person-title-icon person-title-icon--spinning"
          />
        ) : (
          <i className="dx-icon dx-icon-user person-title-icon" />
        )}
        <span className={`person-title-name${isDeleting ? ' person-title-name--deleting' : ''}`}>
          {anzeigename}
          {isDeleting && translate('removingLabel')}
        </span>
      </div>

      {/* Section 2 – delete icon (fixed width, always reserves space) */}
      <div className="person-title-delete-wrapper">
        <button
          className={`dx-button dx-button-normal dx-button-mode-contained person-title-delete-btn delete-favorite-btn${isDeleting ? ' loading-button' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) onDelete();
          }}
          disabled={isDeleting}
          title={isDeleting ? translate('hints.removingFromFavorites') : translate('hints.removeFromFavorites')}
        >
          <i className={`dx-icon dx-icon-${isDeleting ? 'refresh' : 'trash'}`} />
        </button>
      </div>

      {/* Section 3 – reserved space for DevExtreme expansion arrow */}
      <div className="person-title-arrow-spacer" />
    </div>
  );
}