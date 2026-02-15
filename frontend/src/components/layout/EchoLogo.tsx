export function EchoLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="23"
        height="22"
        viewBox="0 0 23 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="6.15381" cy="11" rx="6" ry="11" fill="#FF5310" />
        <ellipse cx="11.9967" cy="11" rx="3.84292" ry="11" fill="#FF5310" />
        <ellipse cx="17.1541" cy="11" rx="2.48659" ry="11" fill="#FF5310" />
        <ellipse
          cx="1.40674"
          cy="11"
          rx="1.40674"
          ry="11"
          transform="matrix(-1 0 0 1 22.8462 0)"
          fill="#FF5310"
        />
      </svg>
      <span className="text-xl font-bold" style={{ color: 'var(--gray-12)' }}>
        ECHO
      </span>
    </div>
  );
}
