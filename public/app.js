// ==========================================================================
// Pollito — 1:1 Slack Block Kit Interactive Poll Simulator
// Matches pure Slack Block Kit message rendering & ASCII progress bars
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const pollState = {
    totalMembers: 12,
    quorumGoalPercent: 75,
    userVotedIndex: 0, // initially option 1 is voted
    options: [
      { id: 1, title: 'Blue Terrace Rooftop', votes: 5 },
      { id: 2, title: 'Downtown Workshop Space', votes: 3 },
      { id: 3, title: 'Virtual (Slack Huddle + Miro)', votes: 2 }
    ]
  };

  const optionRows = document.querySelectorAll('.slack-option-row');
  const voteButtons = document.querySelectorAll('[data-vote-btn]');
  const telemetryEl = document.getElementById('sim-telemetry-text');
  const statusLabelEl = document.getElementById('sim-status-label');
  const mascotEmojiEl = document.getElementById('poll-mascot-emoji');
  const badgeEl = document.getElementById('sim-badge');

  /**
   * Pure Block Kit character progress bar math — identical to
   * src/slack/ui/views/pollMessage.ts & vitest unit tests.
   */
  function renderProgressBar(percentage, totalSlots = 10) {
    const safePct = Math.max(0, Math.min(100, Math.round(percentage)));
    const filledSlots = Math.round((safePct / 100) * totalSlots);
    const emptySlots = totalSlots - filledSlots;

    const filledChar = '█';
    const emptyChar = '░';

    return `${filledChar.repeat(filledSlots)}${emptyChar.repeat(emptySlots)} ${safePct}%`;
  }

  function calculateTotals() {
    const totalVotes = pollState.options.reduce((sum, opt) => sum + opt.votes, 0);
    const quorumPercent = Math.round((totalVotes / pollState.totalMembers) * 100);
    const maxVotes = Math.max(...pollState.options.map(o => o.votes));

    return { totalVotes, quorumPercent, maxVotes };
  }

  function renderPoll() {
    const { totalVotes, quorumPercent, maxVotes } = calculateTotals();
    const isQuorumReached = quorumPercent >= pollState.quorumGoalPercent;

    pollState.options.forEach((opt, index) => {
      const row = document.querySelector(`.slack-option-row[data-index="${index}"]`);
      if (!row) return;

      const percent = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
      const isSelected = pollState.userVotedIndex === index;

      // Update row class
      row.classList.toggle('voted', isSelected);

      // Update ASCII progress bar (code block text)
      const barEl = row.querySelector(`[data-bar="${index}"]`);
      if (barEl) {
        barEl.textContent = renderProgressBar(percent, 10);
      }

      // Update vote count
      const countEl = row.querySelector(`[data-count="${index}"]`);
      if (countEl) {
        countEl.innerHTML = `• <strong>${opt.votes}</strong> ${opt.votes === 1 ? 'vote' : 'votes'}`;
      }

      // Update user voted checkmark
      const checkEl = row.querySelector(`[data-check="${index}"]`);
      if (checkEl) {
        checkEl.style.display = isSelected ? 'inline' : 'none';
      }

      // Update button text and style
      const btn = document.querySelector(`[data-vote-btn="${index}"]`);
      if (btn) {
        btn.classList.toggle('mockup-btn-voted', isSelected);
        const btnText = btn.querySelector('.btn-text');
        if (btnText) {
          btnText.textContent = isSelected ? '✓ Voted' : `Vote ${index + 1}`;
        }
      }
    });

    // Update Telemetry & Quorum status
    if (telemetryEl) {
      telemetryEl.innerHTML = `Quorum target: <strong>${pollState.quorumGoalPercent}%</strong> (${totalVotes}/${pollState.totalMembers} members • <strong>${quorumPercent}%</strong> reached)`;
    }

    if (badgeEl) {
      if (isQuorumReached) {
        badgeEl.textContent = '🎉 Quorum Reached (Closed)';
        badgeEl.classList.add('concluded');
      } else {
        badgeEl.textContent = `⏱️ Quorum Active (${pollState.quorumGoalPercent}% Goal)`;
        badgeEl.classList.remove('concluded');
      }
    }

    if (statusLabelEl) {
      statusLabelEl.textContent = isQuorumReached ? 'Quorum reached • Closed' : 'Poll active';
    }

    if (mascotEmojiEl) {
      if (isQuorumReached) {
        mascotEmojiEl.textContent = '🎉';
      } else if (totalVotes > 0) {
        mascotEmojiEl.textContent = '🧐';
      } else {
        mascotEmojiEl.textContent = '🐣';
      }
    }
  }

  function handleVote(index) {
    if (pollState.userVotedIndex === index) {
      // Toggle vote off
      pollState.options[index].votes -= 1;
      pollState.userVotedIndex = null;
    } else {
      // Switch vote
      if (pollState.userVotedIndex !== null) {
        pollState.options[pollState.userVotedIndex].votes -= 1;
      }
      pollState.options[index].votes += 1;
      pollState.userVotedIndex = index;
    }
    renderPoll();
  }

  // Bind to buttons and rows
  voteButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-vote-btn'), 10);
      handleVote(index);
    });
  });

  optionRows.forEach((row) => {
    row.addEventListener('click', () => {
      const index = parseInt(row.getAttribute('data-index'), 10);
      handleVote(index);
    });
  });

  // Initial render
  renderPoll();
});
