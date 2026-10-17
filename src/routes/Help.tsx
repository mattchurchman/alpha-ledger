import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, DEEP_DISCOUNT, Legend, percent, SectionHeading, WELL_ABOVE, zoneFor } from '../ui'
import { HowCalculatedContent } from './HowCalculated'

/**
 * The user guide: what every screen is for, in what order to use them, and what each number
 * means. Reached from the Help link in the shell header and from Settings.
 *
 * Two rules keep it from going stale:
 *
 * - **No prose restates a threshold or a format.** The discount zones below are rendered from
 *   `DEEP_DISCOUNT` / `WELL_ABOVE` and `zoneFor`, the same constants the meters use, so an
 *   edit to SPEC section 7's thresholds cannot leave a wrong number in the help text.
 * - **The arithmetic lives in one place.** `HowCalculatedContent` is the Settings sheet's own
 *   copy, imported rather than paraphrased - this screen explains *using* the app, and defers
 *   to that for how a figure is worked out.
 *
 * It makes no API call, so it reads the same on a fresh install as on a full ledger.
 */

/** Anchor targets, which double as the "Jump to" list. */
const SECTIONS = [
  { id: 'start', title: 'Getting set up' },
  { id: 'routine', title: 'The routine, once it is running' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'stock', title: 'Stock detail' },
  { id: 'fair-values', title: 'Fair values' },
  { id: 'activity', title: 'Activity' },
  { id: 'import', title: 'Import and reconcile' },
  { id: 'settings', title: 'Settings and market data' },
  { id: 'charts', title: 'Reading the charts' },
  { id: 'numbers', title: 'What each number means' },
  { id: 'install', title: 'Install it on your phone' },
  { id: 'trouble', title: 'When something looks wrong' },
  { id: 'privacy', title: 'Privacy and what this app will not do' },
] as const

export default function Help() {
  return (
    <div className="flex flex-col gap-7">
      <section>
        <SectionHeading>Help</SectionHeading>
        <Card>
          <p className="max-w-prose text-body">
            Alpha Ledger answers two questions about your own portfolio: did your stock picks beat
            the S&amp;P 500 (VOO, bought with the same dollars on the same dates), and which of your holdings are
            trading below your own fair-value estimate.
          </p>
          <p className="mt-3 max-w-prose text-small text-ink-secondary">
            Everything it knows comes from two things you give it: your M1 activity exports, and
            your fair-value estimates. It never trades, never connects to a broker, and never
            fetches a price unless you ask it to.
          </p>
          <nav aria-label="Jump to a section" className="mt-5 border-t border-rule pt-4">
            <p className="label-micro">Jump to</p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {SECTIONS.map(({ id, title }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex min-h-11 items-center text-small text-ink-secondary underline decoration-rule underline-offset-4 hover:text-ink"
                  >
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Card>
      </section>

      <Section id="start" title="Getting set up">
        <Card>
          <p className="max-w-prose text-small text-ink-secondary">
            Five steps, in this order. Each one makes the next one useful: there is nothing to
            compare before the first import, and nothing to value before the first price update.
          </p>
          <ol className="mt-4 flex list-decimal flex-col gap-4 pl-5 text-small text-ink-secondary">
            <li>
              <Step title="Unlock the app">
                Paste the access token from your password manager into the unlock screen. That
                leaves a sign-in cookie on the device for a year, so you do it once per device.
                Nothing else is stored on the device, and the token itself is never kept by the
                page.
              </Step>
            </li>
            <li>
              <Step title="Import your M1 activity">
                Export the activity CSV from each M1 account, then on{' '}
                <Here to="/import">Import</Here> choose all of the files at once. The app recognizes
                an existing account from rows it already has; only a new account needs a label. Read
                the evidence for anything under Needs you, then Accept, Choose, or Ignore it before
                importing.
              </Step>
            </li>
            <li>
              <Step title="Review the import health check">
                Import saves the approved rows, updates market data, and then checks for unpriced
                holdings, possible delistings, and split disagreements. Follow any link it shows;
                otherwise the card says plainly that everything checks out.
              </Step>
            </li>
            <li>
              <Step title="Reconcile against what M1 says you hold">
                On <Here to="/import">Import</Here>, switch to the{' '}
                <strong className="font-medium text-ink">Reconcile</strong> tab and type in the
                share count M1 currently reports for each ticker. Anything off by more than 0.001
                shares is flagged with a one-tap fix. This is the step that proves the rebuilt
                history is right. The import has already updated the split history before sending
                you here.
              </Step>
            </li>
            <li>
              <Step title="Add your fair values">
                On <Here to="/fair-values">Fair values</Here>, give each holding the number you
                think a share is worth. That is the only input behind the discount column and the
                rebuy ranking - the app never estimates a fair value for you.
              </Step>
            </li>
          </ol>
        </Card>
      </Section>

      <Section id="routine" title="The routine, once it is running">
        <Card>
          <dl className="flex flex-col gap-4 text-small text-ink-secondary">
            <Term word="When you want today's picture">
              Tap <strong className="font-medium text-ink">Update</strong> in the header. Every
              screen is valued at the last close the app has stored, which is what the date beside
              the title means; nothing refreshes on its own, so a stale date means exactly that.
            </Term>
            <Term word="After you trade">
              Export the activity CSV again and import it. Re-importing an overlapping export is
              safe: a row already in your ledger is skipped, never overwritten, so an edit or an
              exclusion you made by hand survives. Import also refreshes market data when it
              finishes.
            </Term>
            <Term word="Every so often, or after anything unusual">
              Reconcile again - especially after a split, a spinoff, a merger, or shares transferred
              in from another broker. Those are the cases where M1&rsquo;s share count and the
              rebuilt one can part company.
            </Term>
            <Term word="When your view of a stock changes">
              Add a new fair value. Saving always appends; the old estimate stays in the
              ticker&rsquo;s history and on its chart, so you can see what you thought and when.
            </Term>
          </dl>
        </Card>
      </Section>

      <Section id="dashboard" title="Dashboard">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            The answer to the first question, top to bottom. <Here to="/">Open it</Here>.
          </p>
          <dl className="flex flex-col gap-4">
            <Term word="All accounts, or one">
              If your ledger has more than one account label, a row of buttons sits above the
              headline: <strong className="font-medium text-ink">All accounts</strong> plus one per
              account. Picking one narrows <em>every</em> section below it - headline, history,
              rebuy, holdings and the creators chart - to that account alone. The choice is in the
              address, so a refresh and the back button both keep it, and tapping a ticker opens
              that stock in the same view. With one account there is nothing to switch and the row
              does not appear. One number changes meaning in a narrowed view, and the line under the
              buttons says so: cost basis becomes that account&rsquo;s own average cost, which
              splits the same total return differently between realized and unrealized.
            </Term>
            <Term word="By account">
              In the All view, one line per account under the headline tiles: what it is worth, and
              how it did against the same dollars in the S&amp;P 500. These two do add up to the headline above
              them. Tap a line to switch to that account.
            </Term>
            <Term word="Headline">
              <strong className="font-medium text-ink">Value added vs S&amp;P 500</strong> is the one number
              the app exists for: what your holdings are worth today minus what the same dollars put
              into the S&amp;P 500 on the same days would be worth. The percentage beside it is that gap against
              the S&amp;P 500 side, and it is shown only when the S&amp;P 500 side is positive. Below it sit
              portfolio value, the S&amp;P 500 equivalent, and both IRRs.
            </Term>
            <Term word="A warning under the headline">
              If a holding has no stored price it is counted as $0 and listed there by ticker,
              because portfolio value, total return and value added are all short by whatever it is
              worth. Tap a ticker to open that stock, fetch prices again, or set that one price by
              hand on Settings.
            </Term>
            <Term word="“A holding looks delisted”">
              Below that, any holding with no stored price at all, or whose last close stopped more
              than 30 days before the valuation date. Usually that means the company was bought out
              or merged and the exit was never recorded - M1 pays a buyout out as cash, and the
              import drops cash rows, so the shares are still sitting there. Close or hide… opens
              the same sheet as a holdings row. It is only ever a question: nothing is removed from
              your ledger for you, because a bad day at the price source looks exactly the same from
              here.
            </Term>
            <Term word="History">
              Your portfolio and its S&amp;P 500 shadow as two lines, with the gap between them filled -
              blue where you are ahead, red where you are behind. The range buttons (1W up to All)
              change the window and how closely the chart zooms in on it; they never change how
              anything is computed.
            </Term>
            <Term word="Rebuy opportunities">
              Each holding and each watched ticker that has a fair value, ranked by discount, as a
              two-sided bar growing from fair value - a watched one is labelled
              &ldquo;Watching&rdquo;. Bars and Map (beside the heading) are the same ranking two
              ways: Bars reads best for &ldquo;what is cheapest&rdquo;, Map sizes each tile by
              position value and shades it by discount, for &ldquo;which big holding is
              cheap&rdquo;. Tapping a row or tile opens that stock; Edit beside a row opens the
              fair-value sheet instead, in place. Those with no estimate are listed underneath
              rather than ranked, since there is nothing to rank them by - tap one to set its value
              the same way.
            </Term>
            <Term word="Allocation">
              One bar, a segment per open holding sized by its share of current value - how
              concentrated you are, at a glance. No ring chart: a stacked bar reads at a glance and
              survives greyscale print, where a ring needs either a legend or colour to carry every
              slice&rsquo;s identity. Tap a segment to open that stock.
            </Term>
            <Term word="Holdings">
              One row per open position: shares, price, value, return, value added vs S&amp;P 500, your fair
              value, and the discount. Tap a column heading to sort, tap a row to open that stock.
              Below 640px the table becomes one card per row. Every row carries a Close… button, for
              a company that was bought out, merged, or that you simply want out of sight. If
              anything is hidden, the line under the table says how many - and that they are still
              counted in every total above.
            </Term>
            <Term word="Value creators and destroyers">
              The positions you still hold and still have a price for, as bars either side of zero -
              sorted by how much value each added or destroyed against the S&amp;P 500. Positions you have
              closed are left out, and so is anything with no stored price, because a missing price
              counts as $0 and would draw a holding as a total loss; the subtitle says how many of
              each. That means these bars do not add up to the headline above, which still counts
              every ticker. On a phone it shows the biggest few with a Show all control. Tap a bar
              to open that stock.
            </Term>
          </dl>
        </Card>
      </Section>

      <Section id="stock" title="Stock detail">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            One ticker, in full. You reach it by tapping a row in the Holdings table, a bar in the
            creators chart, or a ticker in Activity - it is not a tab, because it is always a screen
            you push into from a ticker you were already looking at.
          </p>
          <dl className="flex flex-col gap-4">
            <Term word="The same headline, for one stock">
              Value added vs S&amp;P 500 for this ticker, then the shares you hold, current value, its S&amp;P 500
              equivalent, and both IRRs. If no price is stored for the ticker, the shares tile says
              so, because the current value beside it then reads as $0 rather than as a real
              valuation. A position you have closed still has all of these: its current value is
              zero, and the comparison is proceeds plus dividends against what the S&amp;P 500 would have done
              with the same cash flows. Closed positions are labelled, and so are hidden ones. If
              you arrived from a dashboard narrowed to one account, every number here is that
              account&rsquo;s, and the heading beside the ticker says which. A ticker you are only
              watching has none of this - it is labelled &ldquo;Watching&rdquo;, the screen says
              &ldquo;Not held yet&rdquo; where the measures would be, and only the price chart and
              fair-value history below are live.
            </Term>
            <Term word="Across accounts">
              Only when the ticker was traded in more than one account: shares and current value per
              account, which always describe the whole position whichever view you are in. Tapping a
              line narrows this screen and the Dashboard to that account; tapping the one you are
              already in goes back to all of them. An account that held it and sold out stays
              listed, at zero shares, because that is part of where the shares went.
            </Term>
            <Term word="Close or hide…">
              Beside the ticker, for any position that still holds shares. Three choices, and only
              the first two change a number:
              <ul className="mt-1 ml-4 list-disc">
                <li>
                  <strong className="font-medium text-ink">Bought out for cash.</strong> Give the
                  date it settled and the cash, as a total or per share. It writes one sell for
                  every share you held that day, so the shares go to zero and the ticker reads as
                  Closed from then on. The sheet says exactly what it will write before you confirm.
                  Value added then compares the cash you actually got against the same dollars in
                  the S&amp;P 500 - a buyout above the market price shows up as outperformance.
                </li>
                <li>
                  <strong className="font-medium text-ink">Became another ticker.</strong> Records
                  the alias. If one old share became something other than one new share, give the
                  ratio and it writes the share correction too.
                </li>
                <li>
                  <strong className="font-medium text-ink">Just hide it.</strong> Takes it out of
                  Holdings, Rebuy and Fair values and out of nothing else. Unhide in Settings.
                </li>
              </ul>
            </Term>
            <Term word="Your money">
              Invested, returned, and total return split into realized, unrealized and dividends.
            </Term>
            <Term word="Position versus S&amp;P 500">
              This ticker against its own S&amp;P 500 bucket, with a marker at every buy and sell and the
              same range buttons as the dashboard&rsquo;s History chart. A buy or sell from outside
              the chosen window is left off rather than drawn on day one of it.
            </Term>
            <Term word="Decisions">
              One row per buy: the dollars you put in, what those shares are worth now (or what they
              sold for), what the same dollars in the S&amp;P 500 would be worth to the same end point, and the
              difference. This answers &ldquo;was that particular purchase a good idea&rdquo;. On a
              stock that paid dividends these rows do not sum to the ticker&rsquo;s value added,
              because a dividend is not attributed to any one buy - the ticker-level number above is
              the complete one.
            </Term>
            <Term word="Fair value">
              The price line with your estimates drawn as a step line, a marker and its note at each
              change, and the full history underneath - including the only place an estimate can be
              deleted. Old estimates are drawn at today&rsquo;s split level so they line up with the
              price; the number you typed is never rewritten.{' '}
              <strong className="font-medium text-ink">Set value</strong>, beside the heading, opens
              the same fast-entry sheet as Rebuy opportunities and Fair values, for this ticker.
            </Term>
          </dl>
        </Card>
      </Section>

      <Section id="fair-values" title="Fair values">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            Every open holding, plus every ticker you are watching, in one list built for fast entry
            on a phone: tap a row, type the number on the decimal keypad, optionally date it and say
            why, save. The field is already focused when the sheet opens, and{' '}
            <strong className="font-medium text-ink">Save and next</strong> walks every ticker with
            no estimate yet, one after another, without closing the sheet.{' '}
            <Here to="/fair-values">Open it</Here>.
          </p>
          <p className="max-w-prose">
            Saving always adds an entry rather than editing one, so the history is a record of what
            you believed and when. Delete a mistaken entry from that ticker&rsquo;s detail screen.
            Closed positions are not listed here - there is no rebuy decision left to inform - but
            their estimate history is still on their detail screen.
          </p>
          <p className="max-w-prose">
            <strong className="font-medium text-ink">Watch a ticker</strong>, at the bottom, tracks
            a company you do not own yet: type its symbol and tap Watch, which checks it against a
            live price before adding it. A watched ticker is labelled &ldquo;Watching&rdquo; here
            and on Rebuy opportunities, gets priced by Update market data same as a holding, and can
            get a fair value the same way - but it never counts toward a total, never appears on
            Holdings, and Remove takes it off the list with one tap. Buy it for real and it simply
            becomes a holding; nothing is ever listed twice.
          </p>
          <div>
            <p className="label-micro">The zones</p>
            <p className="mt-2 max-w-prose">
              Discount is (fair value − price) ÷ fair value, so a positive number means the price is
              below your estimate.
            </p>
            {/*
              Each row is named by `zoneFor` at a discount inside that zone, so the four labels
              and their order come from the engine rather than from this list. The two
              percentages are the boundary constants themselves, unsigned - the words either
              side of them already carry the direction.
            */}
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              <li>
                <ZoneName discount={DEEP_DISCOUNT} /> - at or beyond{' '}
                {percent(DEEP_DISCOUNT, { sign: false })} below your estimate.
              </li>
              <li>
                <ZoneName discount={DEEP_DISCOUNT / 2} /> - below your estimate, but by less than
                that.
              </li>
              <li>
                <ZoneName discount={WELL_ABOVE / 2} /> - above your estimate.
              </li>
              <li>
                <ZoneName discount={WELL_ABOVE * 1.5} /> - more than{' '}
                {percent(-WELL_ABOVE, { sign: false })} above it.
              </li>
            </ul>
          </div>
        </Card>
      </Section>

      <Section id="activity" title="Activity">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            Every transaction in the ledger, filterable by ticker, account and type, and the place
            to fix anything an import could not get right. <Here to="/activity">Open it</Here>.
          </p>
          <div>
            <p className="label-micro">The five types</p>
            <dl className="mt-2 flex flex-col gap-2">
              <Term word="Buy / Sell">
                Shares and dollars, both required. These are the flows the S&amp;P 500 shadow mirrors.
              </Term>
              <Term word="Dividend">
                Cash the stock paid you. No share count. The shadow treats it as money taken out of
                the position, so it sells that much of the S&amp;P 500 on the same day.
              </Term>
              <Term word="Split">
                Recorded for reference only. Splits are applied from the market-data history, never
                from this row, so a split row cannot double-count.
              </Term>
              <Term word="Adjust">
                A share correction - a spinoff, a merger, shares transferred in from elsewhere. The
                one type whose share count may be negative: positive adds shares, negative removes
                them.
              </Term>
            </dl>
          </div>
          <p className="max-w-prose">
            Amounts are always entered as a positive number; the type carries the direction.{' '}
            <strong className="font-medium text-ink">Exclude</strong> keeps a row but takes it out
            of every calculation, which is what you want for something you are unsure about - prefer
            it to <strong className="font-medium text-ink">Delete</strong>, because an excluded row
            is still there to reconsider and a re-import will not bring a deleted one back to life
            any differently.
          </p>
        </Card>
      </Section>

      <Section id="import" title="Import and reconcile">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            Two tabs on one screen. <Here to="/import">Open it</Here>.
          </p>
          <div>
            <p className="label-micro">Import</p>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-4">
              <li>
                Choose one or more full M1 activity CSVs. An existing account label is inferred from
                source-row overlap and shown with the evidence. You can edit it; only a genuinely
                new account starts blank and asks for a label.
              </li>
              <li>
                The plan, per file, shows the date range,{' '}
                <strong className="font-medium text-ink">new</strong> versus{' '}
                <strong className="font-medium text-ink">already in</strong>, fixes backed by direct
                evidence, and how many decisions still need you. Nothing is written until every
                decision is handled and you tap Import.
              </li>
              <li>
                <strong className="font-medium text-ink">Fixed automatically</strong> is collapsed
                but always explains its evidence. A proven split placeholder can be dropped; an
                exact identifier match can close a cash settlement. These are not guesses.
              </li>
              <li>
                <strong className="font-medium text-ink">Needs you</strong> stays open. Accept a
                proposal whose evidence is right, choose among named candidates, or Ignore the
                source row. Ignore is remembered by its hash, including in backups, so the same row
                does not ask again. Import stays disabled while any question remains.
              </li>
              <li>
                Importing the same export twice is safe. A row already in your ledger is left
                exactly as it is, so your edits and exclusions are never undone by a re-import.
              </li>
              <li>
                After the rows are saved, Import runs Update market data before it offers
                reconciliation. Its health card links unpriced holdings to manual prices and
                aliases, possible delistings to the existing close-out flow, and split disagreements
                to Reconcile.
              </li>
            </ul>
          </div>
          <div>
            <p className="label-micro">Reconcile</p>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-4">
              <li>
                Type one row per ticker with the share count M1 reports now, or load a two-column
                CSV of ticker and shares. Leave{' '}
                <strong className="font-medium text-ink">
                  &ldquo;This is my complete current holdings&rdquo;
                </strong>{' '}
                checked only when the list really is everything you hold - that is what lets it flag
                a ticker the app thinks you own and M1 does not.
              </li>
              <li>
                Anything off by more than 0.001 shares is listed with what the ledger has, what M1
                says, and the difference.{' '}
                <strong className="font-medium text-ink">Transactions</strong> shows that
                ticker&rsquo;s rows so you can find the cause;{' '}
                <strong className="font-medium text-ink">Add adjustment</strong> opens a prefilled
                Adjust transaction for exactly the difference.
              </li>
              <li>
                Split factors come from stored price history. A completed import updates that
                history first; if you open Reconcile on its own, use Update when prices are missing
                or stale.
              </li>
            </ul>
          </div>
        </Card>
      </Section>

      <Section id="settings" title="Settings and market data">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            <Here to="/settings">Open it</Here>.
          </p>
          <dl className="flex flex-col gap-4">
            <Term word="Update market data">
              The one action that fetches prices: the S&amp;P 500 (VOO) plus every ticker ever held, one request each,
              with a progress count. A ticker that fails is named rather than silently skipped. The
              header&rsquo;s Update control does the same thing from anywhere. A closed position
              whose symbol no longer trades is still asked for, but when it fails it is reported
              under the list as expected rather than as a problem - there is nothing left to fetch,
              and its stored history is untouched.
            </Term>
            <Term word="Manual fallback: upload a price CSV">
              For when a ticker cannot be fetched at all - delisted, renamed, or the free data
              source is refusing. One ticker per upload, and the file needs{' '}
              <code className="font-mono">date</code>, <code className="font-mono">close</code> and{' '}
              <code className="font-mono">adjclose</code> columns with dates as{' '}
              <code className="font-mono">YYYY-MM-DD</code>. It merges into whatever is already
              stored and is marked manual. It carries no split events, so a later real update is
              what restores those.
            </Term>
            <Term word="Manual fallback: set current price">
              A single price for one day, defaulting to today and never later - use an earlier date
              to fix one bad or missing past day. Same merge, same manual marking.
            </Term>
            <Term word="Ticker aliases">
              For a rename or a merger. Record the old ticker, the new one, and the date it took
              effect: transactions on or before that date keep the old symbol, and holdings and the
              S&amp;P 500 comparison resolve them under the new one. An alias carries no exchange ratio, so
              if one old share became something other than one new share, the share count needs a
              correction too - the Close or hide… sheet on the stock screen writes both together.
            </Term>
            <Term word="Hidden tickers">
              Everything you have hidden, with what the ledger still says it is worth, and an Unhide
              button each. This is the only place a hidden ticker can be got back, since the other
              screens have stopped showing it. Hiding leaves a ticker out of Holdings, Rebuy
              opportunities and Fair values and out of nothing else -{' '}
              <strong className="font-medium text-ink">it never changes a total</strong>. To take a
              position out of the numbers as well, record its exit from the stock screen.
            </Term>
            <Term word="How this is calculated">
              The arithmetic behind every figure, and the list of things this code knowingly does
              not do. The same text is reproduced below.
            </Term>
          </dl>
        </Card>
      </Section>

      <Section id="charts" title="Reading the charts">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <div>
            <p className="label-micro">What the colours mean</p>
            <div className="mt-2">
              <Legend
                items={[
                  { label: 'Your portfolio', tone: 'you' },
                  { label: 'The S&P 500 shadow', tone: 'voo' },
                  { label: 'Ahead of S&P 500', tone: 'ahead', shape: 'rect' },
                  { label: 'Behind S&P 500', tone: 'behind', shape: 'rect' },
                  { label: 'Your fair value', tone: 'estimate' },
                ]}
              />
            </div>
            <p className="mt-3 max-w-prose">
              Blue is you, graphite is the benchmark, and the filled band between them is the
              headline number drawn to scale. Green appears only on a fair-value chart, where it is
              a level rather than a direction. No chart ever uses colour as the only signal: every
              signed number also carries an arrow and a sign.
            </p>
          </div>
          <div>
            <p className="label-micro">Getting a value off a chart</p>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-4">
              <li>
                Drag across the plot - on a phone, with your thumb. A hairline snaps to the nearest
                trading day and the readout lists every series at that date, so you never have to
                land on a line.
              </li>
              <li>
                With a keyboard: tab to the plot, then ← and → step a day, Home and End jump to the
                ends, Escape clears.
              </li>
              <li>
                Every chart has a <strong className="font-medium text-ink">Table</strong> toggle
                that shows the same numbers as a real table. That is the one to use when you want to
                read values rather than shapes.
              </li>
              <li>Markers and bars are tappable; a time-series line is scrubbed, not tapped.</li>
            </ul>
          </div>
        </Card>
      </Section>

      <Section id="numbers" title="What each number means">
        <Card className="flex flex-col gap-4">
          <dl className="flex flex-col gap-4 text-small text-ink-secondary">
            <Term word="Value added vs S&amp;P 500">
              Current value minus the S&amp;P 500 shadow&rsquo;s value. The headline, and the only number
              that answers the question the app was built for.
            </Term>
            <Term word="S&amp;P 500 equivalent / shadow value">
              What the same dollars, moved into and out of the S&amp;P 500 on the same dates, would be worth
              today. It can be negative - see the note below.
            </Term>
            <Term word="Invested / Returned">
              The sum of your buys, and the sum of your sells plus dividends.
            </Term>
            <Term word="Total return">
              Current value plus what came back, minus what went in, split for display into
              realized, unrealized and dividends.
            </Term>
            <Term word="IRR">
              A money-weighted, annualized return from your actual cash flows, so a large late
              purchase does not get the same weight as an early one. Shown for both sides.
            </Term>
            <Term word="Discount">
              (fair value − price) ÷ fair value. Positive means the price is below your estimate.
            </Term>
            <Term word="Prices as of">
              The last close every figure on the screen is valued at, and when the app last asked
              for prices. &ldquo;Stale&rdquo; appears once that close is more than five trading days
              old.
            </Term>
            <Term word="An em dash (—)">
              Not available, deliberately: an IRR with no sign change in its cash flows, or a
              percentage against an S&amp;P 500 side that is not positive. The app shows a dash rather than a
              number it would have to invent.
            </Term>
          </dl>
          <div className="border-t border-rule pt-4">
            <HowCalculatedContent />
          </div>
        </Card>
      </Section>

      <Section id="install" title="Install it on your phone">
        <Card className="flex flex-col gap-3 text-small text-ink-secondary">
          <p className="max-w-prose">
            It is a web app, so there is nothing to install from a store. On an iPhone: open the app
            in Safari, sign in, tap <strong className="font-medium text-ink">Share</strong>, then{' '}
            <strong className="font-medium text-ink">Add to Home Screen</strong>. It then opens full
            screen, without the browser chrome, and keeps the sign-in cookie for a year. Android
            browsers offer the same thing as{' '}
            <strong className="font-medium text-ink">Install app</strong> or{' '}
            <strong className="font-medium text-ink">Add to Home screen</strong>.
          </p>
          <p className="max-w-prose">
            The theme follows your device&rsquo;s light or dark setting until you override it with
            the toggle in the header, which is the only thing this app stores in the browser itself.
          </p>
        </Card>
      </Section>

      <Section id="trouble" title="When something looks wrong">
        <Card className="flex flex-col gap-2 text-small text-ink-secondary">
          <Faq q="The dashboard says there is no comparison yet.">
            Either nothing is imported, or the S&amp;P 500 has no stored price history. Import an activity
            export, then tap Update - the comparison needs the benchmark before it can draw
            anything.
          </Faq>
          <Faq q="A number looks too low, or a holding is missing from the totals.">
            Check the warning under the dashboard headline. A holding with no stored price counts as
            $0, and every total is short by what it is worth until you fetch that price or set one
            by hand on Settings.
          </Faq>
          <Faq q="Reconcile says a ticker is off by some shares.">
            Open its transactions from the mismatch row. The usual causes are a transfer of shares
            in kind that was never imported (it arrives as an unrecognized row), a spinoff or
            merger, or a split whose price history has not been fetched yet. Fetch prices, then fix
            the rest with an Adjust transaction - the mismatch row can prefill one for exactly the
            difference.
          </Faq>
          <Faq q="A company I was bought out of still shows as a holding.">
            The exit was never recorded. M1 pays a buyout out as cash, and the import drops cash
            rows, so the shares are still in the ledger and no amount of filtering will move them.
            Open that stock (or use the Close… button on its holdings row), choose{' '}
            <strong className="font-medium text-ink">Bought out for cash</strong>, and give the date
            it settled and the cash you received. That writes one sell for every share you held, the
            position goes to zero, and it leaves Holdings, Rebuy and Fair values on its own - still
            counted in the history, labelled Closed. Nothing is deleted.
          </Faq>
          <Faq q="A holding is flagged as looking delisted, but it is fine.">
            That block is a question, not a verdict: all it knows is that no price has arrived, or
            that the last close is over 30 days old. Fetch prices again, or set one by hand on
            Settings, and the flag goes on its own. If you would rather not see it at all, hiding it
            takes it out of the lists without changing a single number.
          </Faq>
          <Faq q="I want a holding out of my lists without touching the numbers.">
            Hide it - from its stock screen, its holdings row, or the delisted prompt. It leaves
            Holdings, Rebuy opportunities and Fair values, and nothing else changes: the headline,
            the history chart and every per-ticker figure still count it in full. The screens that
            hide it say how many are hidden, and Settings lists them with an Unhide button each.
          </Faq>
          <Faq q="A ticker fails every time prices are fetched.">
            The data source is free and unofficial, and a delisted or renamed symbol often has
            nothing behind it. Record the rename as an alias on Settings if that is what happened,
            otherwise use the manual price CSV or set a price by hand. If the position is closed,
            the failure is expected and is reported as such rather than as a problem.
          </Faq>
          <Faq q="A whole position shows a negative S&amp;P 500 equivalent.">
            That is real, not a bug: the stock has paid you back more cash than the same money would
            be worth in the S&amp;P 500, so its shadow bucket is below zero. It is shown as-is rather than
            floored.
          </Faq>
          <Faq q="The import skipped rows I expected it to take.">
            Expand the unrecognized list on that file&rsquo;s preview card. Each entry names its
            line and why. Anything the parser has not been taught is reported rather than guessed
            at, and the fix is a transaction entered by hand on Activity.
          </Faq>
          <Faq q="A row was skipped because its symbol is &ldquo;not a ticker&rdquo;.">
            M1 books some corporate actions against a placeholder rather than the real symbol -
            something like <code className="font-mono">PRESPLITCEIX</code> for a position as it
            stood before a split. Nothing can price that, so it is skipped on purpose. For a split,
            no action is needed: ratios come from the price history, not from a transaction row. For
            anything else that moved real shares, reconcile that ticker and let the mismatch row add
            the adjustment.
          </Faq>
          <Faq q="The date beside the screen title is days old.">
            Nothing fetches prices on its own - that is deliberate, so the app costs nothing to
            leave alone. Tap Update.
          </Faq>
          <Faq q="It is asking for the access token again.">
            The cookie is good for a year per device, so this means it expired, the browser cleared
            it, or the token was rotated. Paste the token again. If every device is asking at once,
            the token has been changed - which is also how you sign every device out on purpose.
          </Faq>
        </Card>
      </Section>

      <Section id="privacy" title="Privacy and what this app will not do">
        <Card className="flex flex-col gap-3 text-small text-ink-secondary">
          <p className="max-w-prose">
            Your transactions, holdings and estimates live in one private database behind the access
            token. There are no analytics, no third-party scripts, and no fonts fetched while you
            use it. The only call that leaves the server is the price fetch, and it carries ticker
            symbols and dates - nothing about you.
          </p>
          <p className="max-w-prose">
            Deliberately absent, and staying absent: trading, any brokerage connection, automated or
            AI-generated recommendations, fair values the app computes for you, news, anything
            social, crypto, financial planning, and tax calculations. The numbers here are for
            reading on a screen; they are not a tax record.
          </p>
        </Card>
      </Section>
    </div>
  )
}

/** A section with an anchor, offset so the sticky header does not cover the heading. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    // The scroll margin clears the sticky header, which is two lines tall with the
    // "prices as of" row under the title.
    <section id={id} className="scroll-mt-32">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  )
}

/** A titled step inside the setup list. */
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <strong className="font-semibold text-ink">{title}.</strong> {children}
    </>
  )
}

/** One term and its explanation. Renders the `<dt>`/`<dd>` pair a `<dl>` needs. */
function Term({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-ink">{word}</dt>
      <dd className="mt-0.5 max-w-prose">{children}</dd>
    </div>
  )
}

/** An in-app link to the screen being described. */
function Here({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-ink underline decoration-rule underline-offset-4">
      {children}
    </Link>
  )
}

/** A zone's own label, read from `zoneFor` so this text cannot disagree with the meters. */
function ZoneName({ discount }: { discount: number }) {
  const zone = zoneFor(discount)
  return (
    <strong className={`font-medium ${zone?.tone === 'ahead' ? 'text-ahead' : 'text-behind'}`}>
      {zone?.label}
    </strong>
  )
}

/** A question that opens. Collapsed by default so the list stays scannable on a phone. */
function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="border-b border-rule pb-2 last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink">
        {q}
      </summary>
      <p className="mb-2 max-w-prose">{children}</p>
    </details>
  )
}
