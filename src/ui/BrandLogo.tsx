/** Approved artwork; CSS follows both the stored theme and the system preference. */
export function BrandLogo({
  stacked = false,
  className = '',
}: {
  stacked?: boolean
  className?: string
}) {
  const name = stacked ? 'lockup-stacked' : 'lockup'
  return (
    <>
      <img
        src={`/brand/${name}.svg`}
        alt="Alpha Ledger"
        className={`al-logo-light object-contain ${className}`}
      />
      <img
        src={`/brand/${name}-reverse.svg`}
        alt="Alpha Ledger"
        className={`al-logo-dark object-contain ${className}`}
      />
    </>
  )
}
