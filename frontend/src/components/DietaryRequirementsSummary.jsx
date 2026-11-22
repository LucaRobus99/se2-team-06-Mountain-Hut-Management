export default function DietaryRequirementsSummary({ requirements = [] }) {
  if (!requirements?.length) return <p className="eh-diet-empty">No dietary requirements added.</p>;
  return <ul className="eh-diet-list">
    {requirements.map((item, index) => (
      <li key={index} className={`eh-diet-card${item.allergies ? ' is-allergy' : ''}`}>
        <span className="eh-diet-label">{item.allergies ? 'Allergy — special care required' : 'Dietary preference'}</span>
        <strong className="eh-diet-description">{item.description}</strong>
      </li>
    ))}
  </ul>;
}
