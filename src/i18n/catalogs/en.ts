/**
 * English source catalog. Keys describe intent, not placement.
 * Spanish (`es.ts`) must define exactly the same keys (enforced at compile time and by tests/i18n/catalogParity.test.ts).
 * Syntax: `{name}` interpolation and ICU `{n, plural, one {..} other {..}}`; `#` prints the plural number.
 */
export const en = {
  // ── Shared ────────────────────────────────────────────────────────────
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.public': 'Public',
  'common.anonymous': 'Anonymous',
  'common.untitledPoll': 'Untitled Poll',

  'status.quorumReached': 'Quorum reached',
  'status.active': 'Active',
  'status.timeExpired': 'Time expired',
  'status.closed': 'Closed',

  // ── Poll message card ─────────────────────────────────────────────────
  'poll.status.active': 'Poll active',
  'poll.status.quorumReached': 'Quorum reached • Closed',
  'poll.status.timeExpired': 'Time limit reached • Closed',
  'poll.status.closed': 'Poll closed',
  'poll.status.approachingQuorum': 'Approaching quorum target',
  'poll.ballot.anonymous': 'Anonymous ballot',
  'poll.ballot.public': 'Public vote',
  'poll.choice.multiple': 'Multiple choice',
  'poll.choice.single': 'Single choice',
  'poll.context.status': '{mascot} *Status:* {status} • *Type:* {ballot} • {choice}',
  'poll.option.votes': '{count, plural, one {*#* vote} other {*#* votes}}',
  'poll.option.moreVoters': '+{count} more',
  'poll.vote.button': 'Vote {number}',
  'poll.nudge.button': 'Nudge Non-Voters',
  'poll.nudge.confirmTitle': 'Send reminder to non-voters?',
  'poll.nudge.confirmBody':
    'Pollito will send a private DM reminder to eligible members in this channel who have not voted yet. Only the poll creator can trigger reminders (4-hour cooldown applies).',
  'poll.nudge.confirmSubmit': 'Send Reminders',
  'poll.close.button': 'Close Poll',
  'poll.close.confirmTitle': 'Close this poll now?',
  'poll.close.confirmBody':
    'Voting will end immediately and final results will be posted to the thread.',
  'poll.close.confirmDeny': 'Keep Open',
  'poll.footer.participants': 'Total participants: {count}',
  'poll.footer.participantsNoQuorum': 'Total participants: {count} • No quorum required',
  'poll.footer.quorumPercent':
    'Quorum target: {target}% ({votes}/{eligible} members • {reached}% reached)',
  'poll.footer.quorumCount':
    'Quorum target: {target, plural, one {# vote} other {# votes}} ({votes}/{target} reached)',
  'poll.footer.closes': 'Closes: {date}',
  'poll.footer.closed': 'Closed: {date}',
  'poll.footer.meta': 'Created by <@{creatorId}> • ID: {pollId}',
  'poll.fallback.active': 'Poll: {question}',
  'poll.fallback.closed': '[Closed] Poll: {question}',
  'poll.fallback.launching': 'Launching poll: {question}...',
  'poll.fallback.creating': 'Creating poll: {question}...',

  // ── Closure announcements ─────────────────────────────────────────────
  'closure.title.quorum': '🎉 *Quorum Reached — Poll Closed*',
  'closure.title.closed': '🔒 *Poll Closed by Creator*',
  'closure.title.expired': '⏰ *Poll Closed — Time Expired*',
  'closure.body.quorum':
    '*{question}* reached its target quorum with {count, plural, one {*#* participant} other {*#* participants}}.',
  'closure.body.closed':
    '*{question}* is now closed with {count, plural, one {*#* total participant} other {*#* total participants}}.',
  'closure.body.closedEmpty': '*{question}* was closed with 0 votes cast.',
  'closure.body.expired':
    '*{question}* concluded with {count, plural, one {*#* total participant} other {*#* total participants}}.',
  'closure.body.expiredEmpty': '*{question}* concluded with 0 votes cast.',
  'closure.outcome.winner':
    'Winner: *{option}* ({votes, plural, one {# vote} other {# votes}}).',
  'closure.outcome.tie':
    'Result: Tie between {options} ({votes, plural, one {# vote} other {# votes}} each).',

  // ── Reminders and notifications ───────────────────────────────────────
  'nudge.dm':
    '👋 Friendly reminder from <@{creatorId}>: Your vote is still needed on *{question}* in <#{channelId}>.',
  'nudge.sent':
    '📬 Sent private reminders to {count, plural, one {# teammate} other {# teammates}}.',
  'nudge.nonePending': 'No pending votes found. Everyone has already cast their ballot!',
  'nudge.disabled': 'Smart Nudges are disabled in this workspace.',
  'nudge.channelTooLarge': 'Smart Nudges are disabled for channels with more than {max} members.',
  'nudge.cooldown': 'A reminder was already sent within the last 4 hours.',
  'nudge.noPoll': 'No active poll found in this channel that you created.',
  'vote.recorded': 'Your vote has been recorded.',
  'vote.recordedAnonymous': 'Your anonymous vote has been recorded.',
  'huddle.reminder.fallback':
    '🗳️ *Remember to vote:* The Huddle has ended, and *{question}* is still open! <{permalink}|View poll in Huddle thread>',
  'huddle.reminder.body':
    '🗳️ *Remember to vote!*\nThe Huddle has ended, and *<{permalink}|{question}>* is still open for voting in the Huddle thread.',
  'huddle.reminder.button': 'Jump to Poll',

  // ── Slash command replies ─────────────────────────────────────────────
  'command.help':
    '*Pollito Quick Help*\n\n• `/pollito`: Opens modal builder.\n• `/pollito "Question" "Option 1" "Option 2"`: Creates an instant poll.\n• `/pollito huddle`: Opens modal to launch a poll inside the active Huddle thread.\n• `/pollito huddle "Question" "Option 1" "Option 2"`: Launches an instant poll inside the active Huddle thread.\n• `/pollito close [poll-id]`: Closes an active poll created by you.\n• `/pollito nudge [poll-id]`: Sends private reminders to non-voters.\n• `/pollito report`: Opens the analytics report for your polls or workspace.\n• Visit App Home to view recent results and templates.',
  'command.noHuddle':
    'No active Huddle thread was found in this channel. Start a Huddle first, or run `/pollito huddle` to open the Huddle poll modal.',
  'command.inviteBot':
    'Pollito needs to be invited to this channel first. Type `/invite @Pollito` and run {command} again.',
  'command.report.summary':
    '*Pollito Analytics ({scope, select, workspace {Workspace} other {Your Polls}})*: {total, plural, one {*#* poll} other {*#* polls}} (*{active}* active, *{quorums}* reached quorum, *{avg}%* avg participation).',
  'command.pollClosed': 'Poll closed successfully: *{question}*',

  // ── Errors surfaced to people ─────────────────────────────────────────
  'error.workspaceIdMissing': 'Workspace ID is missing.',
  'error.activePollInChannel':
    'An active poll is already running in this channel. Close it first or select another channel.',
  'error.pollNotFound': 'Poll not found.',
  'error.pollClosed': 'This poll is closed and no longer accepting votes',
  'error.invalidOption': 'Invalid poll option',
  'error.alreadyVoted': 'You have already voted in this poll',
  'error.alreadyVotedOption': 'You have already voted for this option',
  'error.voteRetriesExhausted': 'Failed to cast vote after maximum retry attempts',
  'error.closeCreatorOnly': 'Only the poll creator can manually close this poll',
  'error.nudgeCreatorOnly': 'Only the poll creator can send nudges for this poll',
  'error.detailsForbidden':
    'Only the poll creator or a workspace admin can view detailed results for this poll.',
  'error.pollDeleteForbidden':
    'Only the poll creator or a workspace admin can delete this poll.',
  'error.templateNameRequired': 'Template name is required.',
  'error.templateNotFound': 'Template not found.',
  'error.templateNotAccessible': 'Template not found or not accessible.',
  'error.templateEditForbidden':
    'Only the template owner or a workspace admin can edit this template.',
  'error.templateDeleteForbidden': 'Only the template owner can delete this template.',
  'error.templateShareForbidden': 'Only the template owner can change sharing permissions.',
  'error.generic.vote': 'An error occurred while voting.',
  'error.generic.close': 'An error occurred while closing the poll.',
  'error.generic.delete': 'Could not delete poll.',
  'error.generic.nudge': 'An error occurred while sending reminders.',
  'error.generic.details': 'Could not open poll details.',
  'error.generic.command': 'An error occurred processing the command.',
  'error.unknownReason': 'Unknown error',
  'poll.create.notInChannel':
    'Pollito is not in <#{channelId}>. Please invite the bot by typing `/invite @Pollito` in that channel, then launch your poll.',
  'poll.create.failed': 'Could not create poll: {reason}.',
  'poll.create.reserveFailed': 'Failed to reserve message timestamp in channel.',

  // ── Form validation ───────────────────────────────────────────────────
  'validation.channelRequired': 'Please select a channel for this poll',
  'validation.questionRequired': 'Please provide a poll question',
  'validation.questionMax': 'Question must not exceed {max} characters',
  'validation.optionRequired': 'Option {number} is required',
  'validation.optionMax': 'Option {number} must not exceed {max} characters',
  'validation.quorumInteger': 'Quorum target must be an integer between 51 and 100',
  'validation.quorumMin': 'Quorum requires a strict majority (51% to 100%)',
  'validation.quorumMax': 'Quorum target must be between 51 and 100',
  'validation.invalidHuddleLink':
    'Invalid Slack thread link or timestamp. Paste a Slack message URL (.../archives/C.../p1234567890123456) or thread_ts (1234567890.123456).',
  'validation.noActiveHuddle':
    'No active Huddle was detected in this channel. Start a Huddle first, or paste the Huddle message link here.',
  'validation.templateNameRequired': 'Please provide a name for this template.',
  'validation.maxNudgeRange':
    'Maximum channel size for Smart Nudges must be an integer between 5 and 500.',
  'validation.selectPollToDelete': 'Please select at least one poll to delete.',

  // ── Quick guide modal ─────────────────────────────────────────────────
  'guide.title': 'Pollito Quick Guide',
  'guide.close': 'Got It',
  'guide.header.how': 'How Pollito Works',
  'guide.step1':
    '*1. Launch in Channel or Huddle Thread*\nOpen the interactive poll builder with `/pollito`, pass options inline for an instant poll, or use `/pollito huddle` to post directly inside an active Slack Huddle thread.',
  'guide.step2':
    '*2. Double-Urn Secret Ballots & Quorum Auto-Closing*\nAnonymous polls separate voter participation records from ballot choices so individual selections cannot be traced. Set a quorum threshold (minimum 51%) to close the poll automatically once enough channel members vote, or choose "No Quorum Required" for casual polls.',
  'guide.step3':
    '*3. Creator Nudges & Role-Scoped Analytics*\nOnly the poll creator can send private DM reminders to non-voters (available in channels up to 50 members with a 4-hour cooldown). Creators see full results for their own polls, while Workspace Admins and Bot Managers can inspect workspace-wide analytics.',
  'guide.header.commands': 'Slash Commands Reference',
  'guide.cmd.builder': '• `/pollito`: Open the interactive poll builder for the current channel',
  'guide.cmd.instant': '• `/pollito "Question" "Option 1" "Option 2"`: Launch an instant poll in the channel',
  'guide.cmd.huddleBuilder':
    '• `/pollito huddle`: Open the poll builder targeted to the active Huddle thread in this channel',
  'guide.cmd.huddleInstant':
    '• `/pollito huddle "Question" "Option 1" "Option 2"`: Launch an instant poll inside the active Huddle thread',
  'guide.cmd.close': '• `/pollito close [poll-id]`: Close an active poll you created',
  'guide.cmd.nudge':
    '• `/pollito nudge [poll-id]`: Send private DM reminders to non-voters (channels up to 50 members)',
  'guide.cmd.report': '• `/pollito report`: View your poll results and analytics report',

  // ── Analytics and poll detail modals ──────────────────────────────────
  'analytics.title': 'Poll Results & Analytics',
  'analytics.scope.personal':
    'Your poll results and participation metrics for the *last {days, plural, one {day} other {# days}}*. Only polls you created appear here. Workspace-wide analytics are visible to workspace admins and bot managers.',
  'analytics.scope.workspace':
    'Workspace-wide poll results and participation metrics for the *last {days, plural, one {day} other {# days}}*.',
  'analytics.metric.quorum':
    '*Quorum Achievement*\n*{rate}%* ({count} reached quorum)',
  'analytics.metric.participation':
    '*Avg. Participation*\n*{pct}%* across eligible members',
  'analytics.metric.ballots':
    '*Total Ballots Cast*\n{votes, plural, one {*#* vote} other {*#* votes}} across {polls, plural, one {*#* poll} other {*#* polls}}',
  'analytics.metric.privacy':
    '*Privacy Split*\n*{publicCount}* Public • *{anonymousCount}* Anonymous',
  'analytics.export.button': 'Customize & Export CSV',
  'analytics.recent.header': 'Recent Poll Results',
  'analytics.empty': 'No polls recorded in this timeframe.',
  'analytics.outcome.none': 'No votes cast',
  'analytics.outcome.tiedLead': 'Tied lead: {options} ({votes})',
  'analytics.outcome.leading': 'Leading: *{option}* ({votes})',
  'analytics.outcome.tie': 'Tie: {options} ({votes})',
  'analytics.outcome.winner': 'Winner: *{option}* ({votes})',
  'analytics.poll.summary':
    'Channel: <#{channelId}> • *{status}* • *{mode}* • {participants, plural, one {*#* participant} other {*#* participants}} • {outcome}',
  'detail.title': 'Poll Results Breakdown',
  'detail.fallbackQuestion': 'Poll Results',
  'detail.mode.anonymous': 'Anonymous (Double-Urn)',
  'detail.field.channel': '*Channel*\n<#{channelId}>',
  'detail.field.status': '*Status & Outcome*\n{status} • {outcome}',
  'detail.field.ballot': '*Ballot Mode*\n{mode} • {choice}',
  'detail.field.quorum': '*Quorum & Turnout*\n{summary}',
  'detail.quorum.none': 'No quorum required',
  'detail.quorum.full':
    'Target: {target}% • Achieved: {achieved}% ({votes}/{eligible} members)',
  'detail.quorum.partial': 'Target: {target}% • Participants: {count}',
  'detail.footer': 'Created by <@{creatorId}> • Poll ID: {pollId}',

  // ── App Home ──────────────────────────────────────────────────────────
  'home.title': 'Pollito',
  'home.greeting.user':
    'Hi, <@{userId}>. Team polls, consensus thresholds, and results in one place.',
  'home.greeting.anonymous': 'Team polls, vote progress, and consensus thresholds in one place.',
  'home.button.launch': 'Launch New Poll',
  'home.button.analytics': 'Results & Analytics',
  'home.button.templates': 'Templates',
  'home.button.guide': 'Guide',
  'home.button.settings': 'Settings',
  'home.button.exportCsv': 'Export CSV',
  'home.button.docs': 'Documentation',
  'home.button.manageHistory': 'Select Polls to Delete',
  'home.button.clearClosed': 'Clear Closed Polls',
  'home.button.viewResults': 'View Results',
  'home.stat.active': '*Active Polls:*\n{count}',
  'home.stat.quorums': '*Quorums Reached:*\n{count}',
  'home.stat.closed': '*Closed Polls:*\n{count}',
  'home.stat.participation': '*Avg. Participation:*\n{pct}%',
  'home.templates.intro': '*Quick Templates*\nLaunch a pre-configured team poll in one click.',
  'home.templates.emptyManager':
    '*Quick Templates*\nNo workspace templates yet. As an admin, you can create quick templates for your team to launch in one click.',
  'home.templates.emptyMember':
    '*Quick Templates*\nNo templates published by workspace admins yet. Open the *Templates* menu above to view or create personal templates.',
  'home.templates.add': '+ Add Template',
  'home.templates.addWorkspace': '+ Add Workspace Template',
  'home.recent.header': 'Recent Polls',
  'home.recent.empty':
    '_No polls yet. Type `/pollito` in any channel or click "Launch New Poll" above._',
  'home.recent.row':
    '*{question}*\nChannel: <#{channelId}> • {votes, plural, one {*#* vote} other {*#* votes}} • *{status}*{role}',
  'home.role.creator': ' • *You are the creator*',
  'home.role.participant': ' • _Participant_',
  'home.delete.confirmTitle': 'Delete this poll?',
  'home.delete.confirmBody':
    'This permanently removes the poll record from App Home and workspace analytics.',
  'home.clear.confirmTitle': 'Clear closed polls?',
  'home.clear.confirmBody': 'This permanently removes finished polls from your App Home history.',
  'home.footer': 'Public and anonymous polls • Quorum & Huddle thread support',

  // ── CSV export and history modals ─────────────────────────────────────
  'csv.title': 'Export Polls CSV',
  'csv.intro':
    'Filter your poll records by date, status, or specific questions, then copy the CSV data below:',
  'csv.status.all': 'All Poll Statuses',
  'csv.status.quorumReached': 'Quorum Reached Only',
  'csv.status.closed': 'Closed Polls Only',
  'csv.status.active': 'Active Polls Only',
  'csv.startDate.placeholder': 'Select start date',
  'csv.startDate.label': 'Start Date (Optional)',
  'csv.endDate.placeholder': 'Select end date',
  'csv.endDate.label': 'End Date (Optional)',
  'csv.statusFilter.label': 'Poll Status Filter',
  'csv.polls.placeholder': 'All polls in range (or pick specific polls)',
  'csv.polls.label': 'Specific Polls to Export',
  'csv.apply': 'Apply Filters',
  'history.title': 'Manage Poll History',
  'history.submit': 'Delete Selected',
  'history.intro':
    'Select one or more polls to permanently remove from App Home history and analytics:',
  'history.placeholder': 'Choose polls to delete',
  'history.label': 'Polls to Delete',

  // ── Templates modal ───────────────────────────────────────────────────
  'templates.title': 'Poll Templates',
  'templates.intro':
    'Save recurring team questions, quorum rules, and ballot settings as reusable poll templates.',
  'templates.button.newWorkspace': '+ Create Workspace Template',
  'templates.button.new': '+ New Template',
  'templates.tab.mine': 'My Templates ({count})',
  'templates.tab.workspace': 'Workspace Templates ({count})',
  'templates.delete.prompt': '*Delete template "{name}"?*\nThis action cannot be undone.',
  'templates.delete.fallbackName': 'Selected Template',
  'templates.delete.confirm': 'Confirm Delete',
  'templates.menu.launch': 'Launch Poll',
  'templates.menu.edit': 'Edit Template',
  'templates.menu.share': 'Share with workspace',
  'templates.menu.unshare': 'Stop sharing',
  'templates.menu.duplicate': 'Duplicate to my templates',
  'templates.menu.delete': 'Delete',
  'templates.menu.unpublish': 'Unpublish (Admin)',
  'templates.row.shared': ' • *Shared*',
  'templates.row.summary':
    '*{name}*{shared}\n_{question}_\n{count, plural, one {# option} other {# options}} • {privacy} • {quorum}',
  'templates.row.noQuorum': 'No quorum',
  'templates.row.quorum': '{target}% quorum',
  'templates.empty.mine':
    '_You have no saved templates yet. Check "Save as reusable template" when creating a poll or duplicate one from Workspace Templates._',
  'templates.empty.workspace':
    '_No workspace templates published yet. Workspace admins and teammates can create templates and share them with the entire team._',

  // ── Workspace settings modal ──────────────────────────────────────────
  'settings.title': 'Workspace Settings',
  'settings.submit': 'Save Settings',
  'settings.readOnly.body':
    '*Read-Only View*\nWorkspace settings can only be modified by Slack Admins and designated Bot Managers.',
  'settings.value.concurrencyMultiple': 'Multiple active polls allowed',
  'settings.value.concurrencySingle': 'Only 1 active poll per channel',
  'settings.value.privacyAnonymous': 'Anonymous Double-Urn',
  'settings.value.privacyPublic': 'Public',
  'settings.value.quorumNone': 'No quorum',
  'settings.value.nudgesEnabled': 'Enabled (up to {max} channel members)',
  'settings.value.nudgesDisabled': 'Disabled',
  'settings.value.managersNone': 'None configured',
  'settings.value.localeAuto': 'Automatic (follows each Slack language)',
  'settings.field.concurrency': '*Channel Concurrency*\n{value}',
  'settings.field.privacy': '*Default Privacy*\n{value}',
  'settings.field.quorum': '*Default Quorum*\n{value}',
  'settings.field.nudges': '*Smart Nudges*\n{value}',
  'settings.field.managers': '*Delegated Bot Managers*\n{value}',
  'settings.field.locale': '*Workspace Language*\n{value}',
  'settings.option.concurrency': '*Allow multiple active polls in one channel*',
  'settings.option.concurrencyHint': 'Unchecked by default: one active poll per channel.',
  'settings.option.anonymous': '*Default to Anonymous Voting (Double-Urn)*',
  'settings.option.nudges': '*Enable Smart Nudges for Poll Creators*',
  'settings.quorum.none': 'No quorum required',
  'settings.quorum.51': '51% — Simple Majority (Half + 1)',
  'settings.quorum.66': '66% — Two-Thirds Supermajority',
  'settings.quorum.70': '70% — Standard Team Consensus',
  'settings.quorum.75': '75% — High Consensus',
  'settings.quorum.80': '80% — Strong Supermajority',
  'settings.quorum.100': '100% — Unanimous',
  'settings.label.concurrency': 'Channel Concurrency',
  'settings.label.privacy': 'Default Privacy & Nudges',
  'settings.label.quorum': 'Default Quorum Threshold',
  'settings.label.maxNudge': 'Max Channel Size for Smart Nudges',
  'settings.hint.maxNudge':
    'Channels larger than this member limit will not show the Nudge Non-Voters button.',
  'settings.label.managers': 'Designated Bot Managers',
  'settings.placeholder.managers': 'Select teammates who can manage workspace settings',
  'settings.label.locale': 'Workspace Language',
  'settings.hint.locale':
    'Used for people whose Slack language Pollito does not support. Each person otherwise sees Pollito in their own Slack language.',
  'settings.locale.auto': 'Automatic (follow each Slack language)',
  'settings.locale.en': 'English',
  'settings.locale.es': 'Español',

  // ── Create poll and template modal ────────────────────────────────────
  'cp.title.huddle': 'Create a Huddle Poll',
  'cp.title.create': 'Create a Poll',
  'cp.title.editTemplate': 'Edit Poll Template',
  'cp.title.newTemplate': 'New Poll Template',
  'cp.title.newWorkspaceTemplate': 'New Workspace Template',
  'cp.submit.launch': 'Launch Poll',
  'cp.submit.saveTemplate': 'Save Template',
  'cp.submit.createTemplate': 'Create Template',
  'cp.huddle.inChannel': ' in <#{channelId}>',
  'cp.huddle.bannerActive':
    '🎧 *Target: Active Huddle Thread*{inChannel}\nThis poll will be posted directly inside the live Huddle thread.',
  'cp.huddle.bannerPending':
    '🎧 *Target: Huddle Thread*{inChannel}\nPollito will auto-detect the active Huddle on launch, or you can paste the Huddle message link below.',
  'cp.channel.placeholder': 'Choose channel',
  'cp.channel.label': 'Channel',
  'cp.channel.labelTemplate': 'Default Channel (Optional)',
  'cp.huddleThread.placeholder': 'Leave blank to auto-detect, or paste Huddle message link / thread ts',
  'cp.huddleThread.label': 'Huddle Thread Link or Timestamp (Optional)',
  'cp.question.placeholder': 'e.g. Which sprint retrospective date works best?',
  'cp.question.label': 'Poll Question',
  'cp.option.label': 'Option {number}',
  'cp.option.placeholder1': 'First option',
  'cp.option.placeholder2': 'Second option',
  'cp.option.placeholder3': 'Third option (optional)',
  'cp.option.placeholder4': 'Fourth option (optional)',
  'cp.settings.label': 'Privacy Settings',
  'cp.settings.anonymous': '*Anonymous Voting (Double-Urn Secret Ballot)*',
  'cp.settings.multiple': '*Multiple Choice*',
  'cp.settings.multipleHint': 'Allow teammates to select more than one option.',
  'cp.settings.noQuorum': '*No Quorum Required*',
  'cp.settings.noQuorumHint': 'No participation threshold. Closes manually or on deadline.',
  'cp.settings.forwardHuddle': '*Remind in Channel When Huddle Ends*',
  'cp.settings.forwardHuddleHint': 'Posts a vote reminder link in the channel when the Huddle ends.',
  'cp.quorum.label': 'Target Quorum Percentage (%)',
  'cp.quorum.hint':
    'Minimum 51% (simple majority: half + 1). Leave blank or check "No Quorum Required" above for casual polls.',
  'cp.duration.none': 'No time limit (Manual / Quorum only)',
  'cp.duration.15m': '15 minutes (Quick Standup)',
  'cp.duration.1h': '1 hour',
  'cp.duration.4h': '4 hours',
  'cp.duration.24h': '24 hours (1 day)',
  'cp.duration.72h': '3 days (72 hours)',
  'cp.duration.7d': '1 week (7 days)',
  'cp.duration.placeholder': 'Select closing duration',
  'cp.duration.label': 'Poll Duration / Deadline',
  'cp.duration.hint':
    'Automatically closes the vote when this time expires, even if quorum has not been reached.',
  'cp.template.name.placeholderNew': 'e.g. Daily Standup Blockers',
  'cp.template.name.placeholderOptional': 'Optional template name (defaults to question)',
  'cp.template.name.label': 'Template Name',
  'cp.template.availability.label': 'Workspace Availability',
  'cp.template.save.label': 'Reusable Template',
  'cp.template.save': '*Save as reusable template (Private to you)*',
  'cp.template.saveHint': 'Stores the question, options, and quorum in your Templates.',
  'cp.template.share': '*Make public to workspace*',
  'cp.template.shareHint': 'Teammates can launch it from App Home and Templates.',
} as const;
