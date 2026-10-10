/**
 * SPEC section 6's "How this is calculated" copy, in one place because two screens show it:
 * the Settings sheet it was written for, and the Help guide's "What each number means"
 * section. Two copies of a limitations list is exactly the kind of thing that drifts.
 *
 * Content only - no card, no sheet, no heading of its own. The caller supplies the container.
 */
export function HowCalculatedContent() {
  return (
    <div className="flex flex-col gap-4 text-small text-ink-secondary">
      <section>
        <h3 className="mb-1 text-small font-semibold text-ink">The VOO comparison</h3>
        <p>
          Every ticker gets its own shadow bucket of VOO. Whenever you buy, sell, or get paid a
          dividend in a stock, the same dollars are imagined going into or out of VOO on the same
          day. Because both sides see the same cash flows, the gap between them - what your shares
          are worth today versus what that VOO bucket is worth today - is the result of your stock
          picking, nothing else. VOO&rsquo;s bucket uses its adjusted close, which already includes
          VOO&rsquo;s own reinvested dividends.
        </p>
      </section>
      <section>
        <h3 className="mb-1 text-small font-semibold text-ink">A bucket can go negative</h3>
        <p>
          If a stock has paid you back more cash than the same money would be worth in VOO, its
          shadow bucket shows as negative. That is shown as-is, not floored at zero - it means the
          position has already returned more than a VOO equivalent would be worth.
        </p>
      </section>
      <section>
        <h3 className="mb-1 text-small font-semibold text-ink">The numbers on each screen</h3>
        <p>
          Invested and returned are the sum of your buys and of your sells plus dividends. Total
          return splits into realized gain (from shares you have sold), unrealized gain (from shares
          you still hold), and dividends. Value added is current value minus the VOO bucket, and it
          stays meaningful for a closed position, where current value is zero. IRR is a
          money-weighted, annualized return solved from your actual cash flows - when there is no
          sign change among them, or the VOO bucket is not positive, it shows a dash rather than a
          guess.
        </p>
      </section>
      <section>
        <h3 className="mb-1 text-small font-semibold text-ink">What is ignored</h3>
        <p>
          Taxes, brokerage fees, and cash sitting idle between trades are ignored on both sides of
          every comparison. This app answers one question - did the picks beat VOO - not what you
          would have kept after taxes or fees.
        </p>
      </section>
      {/*
       * Task 15's deliverable. Every item here is a limitation of the shipped code, not a
       * caveat in general - each one was checked against the module that causes it. Add to
       * this list when a task knowingly leaves a gap the numbers depend on; take an item
       * out when the gap closes.
       */}
      <section>
        <h3 className="mb-1 text-small font-semibold text-ink">Known limitations</h3>
        <ul className="flex list-disc flex-col gap-2 pl-4">
          <li>
            <strong className="font-medium text-ink">
              The math has not been checked against a real export yet.
            </strong>{' '}
            It is covered by tests on made-up portfolios, which proves it is self-consistent, not
            that it matches what your broker says you hold. Reconcile on the Import screen is the
            check that settles that, and it has not been run on real history.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Shares moved in or out of the account are not imported.
            </strong>{' '}
            A cash deposit or withdrawal is correctly ignored, but a transfer of shares in kind is
            reported as an unrecognized row on import and needs an adjustment entered by hand. Until
            it is, that ticker&rsquo;s share count - and so its value - is wrong.
          </li>
          <li>
            <strong className="font-medium text-ink">
              A holding with no stored price counts as zero.
            </strong>{' '}
            It is listed on the dashboard under the headline rather than hidden, so you can see
            which totals are short, but the totals themselves are still short until that price is
            fetched or entered.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Prices move only when you tap Update market data.
            </strong>{' '}
            Everything is valued at the last close that was stored, which is also what the date at
            the top of every screen means. Nothing refreshes on its own.
          </li>
          <li>
            <strong className="font-medium text-ink">
              A price history you upload by hand carries no split events.
            </strong>{' '}
            Splits come from the market-data fetch, so a hand-uploaded CSV leaves that
            ticker&rsquo;s share counts unadjusted for any split until the next real update replaces
            the series.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Cost basis is average cost, not tax lots.
            </strong>{' '}
            Realized and unrealized gain use one average cost per ticker across all accounts. That
            is for reading on a screen, not for a tax return.
          </li>
          <li>
            <strong className="font-medium text-ink">
              On a stock that paid dividends, the per-purchase figures do not add up to the
              ticker&rsquo;s total.
            </strong>{' '}
            Dividends are not attributed to individual purchases. The ticker-level value added is
            the honest number; the purchase list answers the narrower question of whether that
            particular buy was a good idea.
          </li>
        </ul>
      </section>
    </div>
  )
}
