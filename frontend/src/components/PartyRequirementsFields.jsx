import { useRef } from 'react';
import { MAX_REQUIREMENT_DESCRIPTION_LENGTH } from '../utils/partyRequirements.js';

// MH-05. A row represents one dietary requirement for one subset of the party.
// IDs only stabilize React rendering: the API receives description + allergies.
export default function PartyRequirementsFields({ requirements, onChange, showErrors = false, disabled = false }) {
  const nextId = useRef(Math.max(0, ...requirements.map((entry) => entry.id || 0)));

  function addRequirement() {
    const id = ++nextId.current;
    onChange([...requirements, { id, description: '', allergies: false }]);
  }

  function updateRequirement(id, patch) {
    onChange(requirements.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function removeRequirement(id) {
    onChange(requirements.filter((entry) => entry.id !== id));
  }

  return (
    <section className="eh-party-requirements" aria-labelledby="eh-party-requirements-title">
      <div className="eh-party-requirements-heading">
        <h2 id="eh-party-requirements-title">Dietary requirements &amp; allergies</h2>
        <span className="eh-party-optional">Optional</span>
      </div>
      <p className="eh-party-explanation">
        Add any allergies or special diets, including how many guests are affected.
      </p>

      {requirements.length === 0 && (
        <p className="eh-party-empty">No dietary requirements added.</p>
      )}

      <div className="eh-party-entries">
        {requirements.map((entry, index) => {
          const descriptionId = `eh-diet-description-${entry.id}`;
          const allergyId = `eh-diet-allergy-${entry.id}`;
          const invalidDescription = showErrors && !entry.description.trim();
          return (
            <div className="eh-party-entry" key={entry.id}>
              <div className="eh-party-entry-heading">
                <h3>Requirement {index + 1}</h3>
                <button type="button" className="eh-party-remove" disabled={disabled}
                  onClick={() => removeRequirement(entry.id)} aria-label={`Remove requirement ${index + 1}`}>
                  Remove
                </button>
              </div>
              <label className="eh-party-label" htmlFor={descriptionId}>Description</label>
              <textarea id={descriptionId} className={`eh-party-textarea${invalidDescription ? ' is-invalid' : ''}`}
                rows={2} maxLength={MAX_REQUIREMENT_DESCRIPTION_LENGTH} disabled={disabled}
                value={entry.description}
                onChange={(event) => updateRequirement(entry.id, { description: event.target.value })}
                placeholder="e.g. 1 vegan guest with a peanut allergy"
                aria-invalid={invalidDescription}
                aria-describedby={`${descriptionId}-hint${invalidDescription ? ` ${descriptionId}-error` : ''}`} />
              <span id={`${descriptionId}-hint`} className="eh-party-field-hint">
                Include the number of people affected and their dietary needs.
              </span>
              {invalidDescription && <span id={`${descriptionId}-error`} className="eh-party-error" role="alert">Enter a description or remove this entry.</span>}
              <label className="eh-party-allergy" htmlFor={allergyId}>
                <input type="checkbox" id={allergyId} checked={entry.allergies} disabled={disabled}
                  onChange={(event) => updateRequirement(entry.id, { allergies: event.target.checked })} />
                <span><strong>Contains an allergy</strong><small>Check this if any guest in this entry has an allergy. <br></br> Special care is needed during preparation.</small></span>
              </label>
            </div>
          );
        })}
      </div>

      <button type="button" className="eh-party-add" onClick={addRequirement} disabled={disabled}>
        <span aria-hidden="true">＋</span> Add dietary requirement
      </button>
      <p className="eh-party-privacy">Only share information needed to prepare your party’s meals safely.</p>
    </section>
  );
}
