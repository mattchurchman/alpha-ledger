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
            putting the same dollars into VOO on the same dates, and which of your holdings are
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
                <Here to="/import">Import</Here> choose all of the files at once. Give every file
                the account it came from as its label - that label is what keeps the same trade in
                two accounts from being treated as one. The preview counts what is new, what you
                already have, and what it could not classify before anything is saved.
              </Step>
            </li>
            <li>
              <Step title="Fetch prices">
                Tap <strong className="font-medium text-ink">Update</strong> in the header, or{' '}
                <strong className="font-medium text-ink">Update market data</strong> on{' '}
                <Here to="/settings">Settings</Here>. This fetches VOO plus every ticker you have
                ever held, one at a time, with a running count and a list of any ticker that failed.
                Until VOO has a stored history there is no benchmark, so the dashboard stays empty.
              </Step>
            </li>
            <li>
              <Step title="Reconcile against what M1 says you hold">
                On <Here to="/import">Import</Here>, switch to the{' '}
                <strong className="font-medium text-ink">Reconcile</strong> tab and type in the
                share count M1 currently reports for each ticker. Anything off by more than 0.001
                shares is flagged with a one-tap fix. This is the step that proves the rebuilt
                history is right; do it after fetching prices, because a split is only applied once
                the price history that records it is stored.
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
              exclusion you made by hand survives.
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
            <Term word="Headline">
              <strong className="font-medium text-ink">Value added vs VOO</strong> is the one number
              the app exists for: what your holdings are worth today minus what the same dollars put
              into VOO on the same days would be worth. The percentage beside it is that gap against
              the VOO side, and it is shown only when the VOO side is positive. Below it sit
              portfolio value, the VOO equivalent, and both IRRs.
            </Term>
            <Term word="A warning under the headline">
              If a holding has no stored price it is counted as $0 and listed there by ticker,
              because portfolio value, total return and value added are all short by whatever it is
              worth. Fetch prices again, or set that one price by hand on Settings.
            </Term>
            <Term word="History">
              Your portfolio and its VOO shadow as two lines, with the gap between them filled -
              blue where you are ahead, red where you are behind. The 1Y / 3Y / All buttons change
              the window only; they never change how anything is computed.
            </Term>
            <Term word="Rebuy opportunities">
              Each holding that has a fair value, ranked by discount, drawn as a meter with the zone
              named. Holdings with no estimate are listed underneath rather than ranked, since there
              is nothing to rank them by.
            </Term>
            <Term word="Holdings">
              One row per open position: price, value, return, value added vs VOO, your fair value,
              and the discount. Tap a column heading to sort, tap a row to open that stock. Below
              640px the table becomes one card per row.
            </Term>
            <Term word="Value creators and destroyers">
              Every ticker you have ever held, closed positions included, as bars either side of
              zero - sorted by how much value each added or destroyed against VOO. On a phone it
              shows the biggest few with a Show all control. Tap a bar to open that stock.
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
              Value added vs VOO for this ticker, then current value, its VOO equivalent, and both
              IRRs. A position you have closed still has all of these: its current value is zero,
              and the comparison is proceeds plus dividends against what VOO would have done with
              the same cash flows. Closed positions are labelled.
            </Term>
            <Term word="Your money">
              Invested, returned, and total return split into realized, unrealized and dividends.
            </Term>
            <Term word="Position versus VOO">
              This ticker against its own VOO bucket, with a marker at every buy and sell.
            </Term>
            <Term word="Decisions">
              One row per buy: the dollars you put in, what those shares are worth now (or what they
              sold for), what the same dollars in VOO would be worth to the same end point, and the
              difference. This answers &ldquo;was that particular purchase a good idea&rdquo;. On a
              stock that paid dividends these rows do not sum to the ticker&rsquo;s value added,
              because a dividend is not attributed to any one buy - the ticker-level number above is
              the complete one.
            </Term>
            <Term word="Fair value">
              The price line with your estimates drawn as a step line, a marker and its note at each
              change, and the full history underneath - including the only place an estimate can be
              deleted. Old estimates are drawn at today&rsquo;s split level so they line up with the
              price; the number you typed is never rewritten.
            </Term>
          </dl>
        </Card>
      </Section>

      <Section id="fair-values" title="Fair values">
        <Card className="flex flex-col gap-4 text-small text-ink-secondary">
          <p className="max-w-prose">
            Every open holding in one list, built for fast entry on a phone:{' '}
            <strong className="font-medium text-ink">Set value</strong> on a row, type the number,
            optionally date it and say why, save. <Here to="/fair-values">Open it</Here>.
          </p>
          <p className="max-w-prose">
            Saving always adds an entry rather than editing one, so the history is a record of what
            you believed and when. Delete a mistaken entry from that ticker&rsquo;s detail screen.
            Closed positions are not listed here - there is no rebuy decision left to inform - but
            their estimate history is still on their detail screen.
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
                Shares and dollars, both required. These are the flows the VOO shadow mirrors.
              </Term>
              <Term word="Dividend">
                Cash the stock paid you. No share count. The shadow treats it as money taken out of
                the position, so it sells that much VOO on the same day.
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
                Choose one or more M1 activity CSVs. The filename becomes the account label, so
                naming each export after its account saves you a step - and the label matters,
                because it is what distinguishes the same trade made in two accounts.
              </li>
              <li>
                The preview, per file, shows a count by type, the date range,{' '}
                <strong className="font-medium text-ink">new</strong> versus{' '}
                <strong className="font-medium text-ink">already in your ledger</strong>, and two
                expandable lists. Nothing is written until you tap Confirm import.
              </li>
              <li>
                <strong className="font-medium text-ink">Dropped</strong> rows are cash the app
                deliberately ignores: deposits, withdrawals, fees, interest, transfers of cash. Idle
                cash is outside what this app measures.
              </li>
              <li>
                <strong className="font-medium text-ink">Unrecognized</strong> rows are the ones to
                read. They are skipped, not guessed at, and each is reported with its line number. A
                transfer of shares in kind is the common case: it needs an{' '}
                <strong className="font-medium text-ink">Adjust</strong> transaction entered by hand
                on Activity, and until it is, that ticker&rsquo;s share count is wrong.
              </li>
              <li>
                Importing the same export twice is safe. A row already in your ledger is left
                exactly as it is, so your edits and exclusions are never undone by a re-import.
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
                Fetch prices before reconciling. Split factors come from the stored price history,
                and without it every share count is compared in pre-split terms.
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
              The one action that fetches prices: VOO plus every ticker ever held, one request each,
              with a progress count. A ticker that fails is named rather than silently skipped. The
              header&rsquo;s Update control does the same thing from anywhere.
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
              A single price for today, for when all you need is a current valuation. Same merge,
              same manual marking.
            </Term>
            <Term word="Ticker aliases">
              For a rename or a merger. Record the old ticker, the new one, and the date it took
              effect: transactions on or before that date keep the old symbol, and holdings and the
              VOO comparison resolve them under the new one.
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
                  { label: 'The VOO shadow', tone: 'voo' },
                  { label: 'Ahead of VOO', tone: 'ahead', shape: 'rect' },
                  { label: 'Behind VOO', tone: 'behind', shape: 'rect' },
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
            <Term word="Value added vs VOO">
              Current value minus the VOO shadow&rsquo;s value. The headline, and the only number
              that answers the question the app was built for.
            </Term>
            <Term word="VOO equivalent / shadow value">
              What the same dollars, moved into and out of VOO on the same dates, would be worth
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
              percentage against a VOO side that is not positive. The app shows a dash rather than a
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
            Either nothing is imported, or VOO has no stored price history. Import an activity
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
          <Faq q="A ticker fails every time prices are fetched.">
            The data source is free and unofficial, and a delisted or renamed symbol often has
            nothing behind it. Record the rename as an alias on Settings if that is what happened,
            otherwise use the manual price CSV or set a current price by hand.
          </Faq>
          <Faq q="A whole position shows a negative VOO equivalent.">
            That is real, not a bug: the stock has paid you back more cash than the same money would
            be worth in VOO, so its shadow bucket is below zero. It is shown as-is rather than
            floored.
          </Faq>
          <Faq q="The import skipped rows I expected it to take.">
            Expand the unrecognized list on that file&rsquo;s preview card. Each entry names its
            line and why. Anything the parser has not been taught is reported rather than guessed
            at, and the fix is a transaction entered by hand on Activity.
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
