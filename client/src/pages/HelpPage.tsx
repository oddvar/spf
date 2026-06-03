export default function HelpPage() {
  return (
    <div className="help-page">
      <h1>How to use SPF 2026</h1>

      <section className="help-section">
        <h2>Group stage predictions</h2>
        <p>
          For each of the 72 group stage matches, pick the result you expect:
        </p>
        <ul>
          <li><strong>H</strong> — Home win</li>
          <li><strong>D</strong> — Draw</li>
          <li><strong>A</strong> — Away win</li>
        </ul>
        <p>
          You can sort matches by date or by group using the toggle at the top right.
          Predictions are saved automatically as you click.
        </p>
        <p>
          Once all 72 matches are predicted, the <strong>Next</strong> button unlocks.
        </p>
      </section>

      <section className="help-section">
        <h2>Best third-placed teams</h2>
        <p>
          The top two teams from each of the 12 groups advance automatically to the Round of 32.
          In addition, the <strong>8 best third-placed teams</strong> also qualify.
        </p>
        <p>
          The tables on this page show the predicted standings for each group based on your
          group stage predictions. Click a third-place row (row 3 in each table) to select
          that group's third-placed team as one of the 8 qualifiers (or to de-select it).
        </p>
        <p>
          If two teams in a group are tied on points, use the <strong>▲▼ arrows</strong> to
          set your preferred tiebreaker order.
        </p>
        <p>
          The rows highlighted in purple are the top 8 third-placed teams by points — only
          these are selectable. Once you have selected 8, the <strong>Next</strong> button unlocks.
        </p>
        <p>
          <strong>Note:</strong> changing any group stage prediction will reset your best-thirds
          selections, so complete your group stage predictions first.
        </p>
      </section>

      <section className="help-section">
        <h2>Knockout stage</h2>
        <p>
          The bracket is populated from your group stage predictions and best-thirds selections,
          using the official FIFA assignment table (Annex C of the 2026 regulations).
        </p>
        <p>
          Click a team in a match box to predict them as the winner. There are no draws in the
          knockout stage. Each subsequent round unlocks once the previous round is fully predicted:
        </p>
        <ol>
          <li>Round of 32 (16 matches)</li>
          <li>Round of 16 (8 matches)</li>
          <li>Quarter-finals (4 matches)</li>
          <li>Semi-finals (2 matches)</li>
          <li>Final &amp; 3rd place match</li>
        </ol>
      </section>

      <section className="help-section">
        <h2>Scoring</h2>
        <table className="help-scoring-table">
          <tbody>
            <tr><td>Group matches — each correct H/D/A prediction</td><td>1</td></tr>
            <tr><td>Round of 32 — each correct team</td><td>2</td></tr>
            <tr><td>Round of 16 — each correct team</td><td>3</td></tr>
            <tr><td>Quarter-finals — each correct team</td><td>4</td></tr>
            <tr><td>Semi-finals — each correct team</td><td>5</td></tr>
            <tr><td>Final — each correct team</td><td>6</td></tr>
            <tr><td>Third place</td><td>7</td></tr>
            <tr><td>Winner</td><td>15</td></tr>
            <tr className="help-scoring-total"><td>Total available points</td><td>270</td></tr>
          </tbody>
        </table>
      </section>

      <section className="help-section">
        <h2>Winning</h2>
        <p>
          Out of everyone who chose to pay, the person with the highest number of points at the end of the World Cup is the winner!
        </p>
        <p>
          The winner receives <strong>75% of the total money paid</strong>, and the person with the second-most points receives <strong>25% as a consolation prize</strong>.
        </p>
        <p>
          If multiple people tie for the highest points, they split the prize (and there is no consolation prize). If multiple people tie for second place, they split the consolation prize.
        </p>
      </section>

      <section className="help-section">
        <h2>Payment</h2>
        <p>
          This competition has both free and paid entry options. You can choose whether to participate in the paid competition when you register.
        </p>
        <p>
          If you select <strong>"I want to join — I'll pay soon"</strong>, please transfer 100 NOK to account number 9710 5671 052.
        </p>
        <p>
          Only participants who chose to pay are eligible for the prize pool (75% to the winner, 25% to the runner-up).
        </p>
      </section>

      <section className="help-section">
        <h2>Questions?</h2>
        <p>
          If you have any questions about the competition, the predictions, or a bug report, please feel free to email <a href="mailto:oddvar@geheb.com" className="help-link">the administrator</a>.
        </p>
      </section>
    </div>
  );
}
