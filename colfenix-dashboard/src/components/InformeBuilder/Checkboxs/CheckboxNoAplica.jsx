export default function CheckboxNoAplica({ value, onChange }) {
    return (
        <label style={{display: "flex", gap: 8, alignItems: "center", marginBottom: 20}}>
            <input
                type="checkbox"
                checked={value}
                onChange={onChange}
            />
            <span>No aplica</span>
        </label>
    )
}
