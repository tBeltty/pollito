// ==========================================================================
// Pollito — Interactive Poll Simulator (Vanilla ES)
// Zero dependencies, fast and accessible
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const pollState = {
    totalMembers: 12,
    quorumGoalPercent: 75,
    userVotedIndex: 0, // initially option 1 is selected
    options: [
      { id: 1, title: 'Blue Terrace Rooftop', votes: 5 },
      { id: 2, title: 'Downtown Workshop Space', votes: 3 },
      { id: 3, title: 'Virtual Huddle + Miro', votes: 2 }
    ]
  };

  const optionElements = document.querySelectorAll('.poll-option-item');
  const quorumTextEl = document.getElementById('quorum-text');
  const pollStatusIconEl = document.getElementById('poll-status-icon');
  const totalVotesCountEl = document.getElementById('total-votes-count');

  function calculateTotals() {
    const totalVotes = pollState.options.reduce((sum, opt) => sum + opt.votes, 0);
    const quorumPercent = Math.round((totalVotes / pollState.totalMembers) * 100);
    const maxVotes = Math.max(...pollState.options.map(o => o.votes));

    return { totalVotes, quorumPercent, maxVotes };
  }

  function renderPoll() {
    const { totalVotes, quorumPercent, maxVotes } = calculateTotals();

    pollState.options.forEach((opt, index) => {
      const el = optionElements[index];
      if (!el) return;

      const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
      const isSelected = pollState.userVotedIndex === index;
      const isWinner = opt.votes === maxVotes && opt.votes > 0;

      // Update classes
      el.classList.toggle('selected', isSelected);

      // Update meta text
      const metaEl = el.querySelector('.option-meta');
      if (metaEl) {
        metaEl.textContent = `${percent}% (${opt.votes} votes)${isSelected ? ' ✓' : ''}`;
      }

      // Update progress bar
      const fillEl = el.querySelector('.progress-fill');
      if (fillEl) {
        fillEl.style.width = `${percent}%`;
        fillEl.classList.toggle('winner', isWinner);
      }
    });

    // Update Quorum status
    if (quorumTextEl) {
      const isQuorumReached = quorumPercent >= pollState.quorumGoalPercent;
      quorumTextEl.textContent = `${totalVotes}/${pollState.totalMembers} members voted (${quorumPercent}% quorum)`;
      
      if (pollStatusIconEl) {
        if (isQuorumReached) {
          pollStatusIconEl.textContent = '🎉';
        } else if (totalVotes > 0) {
          pollStatusIconEl.textContent = '🧐';
        } else {
          pollStatusIconEl.textContent = '🐣';
        }
      }
    }

    if (totalVotesCountEl) {
      totalVotesCountEl.textContent = `${totalVotes} total votes`;
    }
  }

  // Bind click handlers
  optionElements.forEach((el, index) => {
    el.addEventListener('click', () => {
      if (pollState.userVotedIndex === index) {
        // Toggle vote off
        pollState.options[index].votes -= 1;
        pollState.userVotedIndex = null;
      } else {
        // Shift vote from previous option to new option
        if (pollState.userVotedIndex !== null) {
          pollState.options[pollState.userVotedIndex].votes -= 1;
        }
        pollState.options[index].votes += 1;
        pollState.userVotedIndex = index;
      }
      renderPoll();
    });
  });

  // Initial render
  renderPoll();
});
