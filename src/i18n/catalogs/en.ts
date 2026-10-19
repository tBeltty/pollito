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
  'common.untitledPoll': 'Untitled poll',

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
  'poll.nudge.button': 'Remind non-voters',
  'poll.nudge.confirmTitle': 'Send reminder to non-voters?',
  'poll.nudge.confirmBody':
    'Pollito will send a private DM to members of this channel who have not voted yet. Only the poll creator can send reminders, and each poll allows one every {hours, plural, one {hour} other {# hours}}.',
  'poll.nudge.confirmSubmit': 'Send reminders',
  'poll.close.button': 'Close poll',
  'poll.close.confirmTitle': 'Close this poll now?',
  'poll.close.confirmBody':
    'Voting will end immediately and final results will be posted to the thread.',
  'poll.close.confirmDeny': 'Keep open',
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
  'closure.title.quorum': '🎉 *Quorum reached. Poll closed*',
  'closure.title.closed': '🔒 *Poll closed by its creator*',
  'closure.title.expired': '⏰ *Poll closed. Time expired*',
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
    '👋 <@{creatorId}> would like your vote on *{question}* in <#{channelId}>.',
  'nudge.sent':
    '📬 Sent private reminders to {count, plural, one {# teammate} other {# teammates}}.',
  'nudge.nonePending': 'No pending votes found. Everyone has already cast their ballot!',
  'nudge.disabled': 'Reminders are turned off in this workspace.',
  'nudge.channelTooLarge': 'Reminders are not available in channels with more than {max} members.',
  'nudge.cooldown': 'A reminder was already sent in the last {hours, plural, one {hour} other {# hours}}.',
  'nudge.noPoll': 'No active poll found in this channel that you created.',
  'vote.recorded': 'Your vote has been recorded.',
  'vote.recordedAnonymous': 'Your anonymous vote has been recorded.',
  'huddle.reminder.fallback':
    '🗳️ The Huddle ended and *{question}* is still open for votes. <{permalink}|Vote in the thread>',
  'huddle.reminder.body':
    '🗳️ *The Huddle has ended.*\n*<{permalink}|{question}>* is still open for votes in the Huddle thread.',
  'huddle.reminder.button': 'Jump to poll',

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
  'error.workspaceIdMissing': 'Something went wrong. Try again.',
  'error.activePollInChannel':
    'An active poll is already running in this channel. Close it first or select another channel.',
  'error.pollNotFound': 'Poll not found.',
  'error.pollClosed': 'This poll is closed and no longer accepting votes.',
  'error.invalidOption': 'Invalid poll option.',
  'error.alreadyVoted': 'You have already voted in this poll.',
  'error.alreadyVotedOption': 'You have already voted for this option.',
  'error.voteRetriesExhausted': 'Couldn\'t record your vote. Try again in a moment.',
  'error.closeCreatorOnly': 'Only the poll creator can manually close this poll.',
  'error.nudgeCreatorOnly': 'Only the poll creator can send reminders for this poll.',
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
  'error.unknownReason': 'Something went wrong',
  'poll.create.notInChannel':
    'Pollito is not in <#{channelId}>. Please invite the bot by typing `/invite @Pollito` in that channel, then launch your poll.',
  'poll.create.failed': 'Could not create poll: {reason}.',
  'poll.create.reserveFailed': 'Couldn\'t post the poll in the channel. Try again.',

  // ── Form validation ───────────────────────────────────────────────────
  'validation.channelRequired': 'Please select a channel for this poll',
  'validation.questionRequired': 'Please provide a poll question',
  'validation.questionMax': 'Question must not exceed {max} characters',
  'validation.optionRequired': 'Option {number} is required',
  'validation.optionMax': 'Option {number} must not exceed {max} characters',
  'validation.quorumInteger': 'Quorum target must be an integer between 51 and 100',
  'validation.quorumMin': 'Quorum must be more than half (51% to 100%)',
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
  'guide.title': 'Pollito quick guide',
  'guide.close': 'Got it',
  'guide.header.how': 'How Pollito works',
  'guide.step1':
    '*1. Launch in Channel or Huddle Thread*\nOpen the interactive poll builder with `/pollito`, pass options inline for an instant poll, or use `/pollito huddle` to post directly inside an active Slack Huddle thread.',
  'guide.step2':
    '*2. Anonymous polls and quorum*\nIn anonymous polls nobody can see who voted for what. Set a quorum of 51% or more to close the poll as soon as enough channel members have voted, or choose "No quorum required" for casual polls.',
  'guide.step3':
    '*3. Reminders and results*\nOnly the poll creator can send private reminders to non-voters, in channels under the size limit set in Settings, with one reminder every {hours, plural, one {hour} other {# hours}}. Creators see full results for their own polls. Workspace admins and Pollito managers can see results for the whole workspace.',
  'guide.header.commands': 'Slash commands reference',
  'guide.cmd.builder': '• `/pollito`: Open the interactive poll builder for the current channel',
  'guide.cmd.instant': '• `/pollito "Question" "Option 1" "Option 2"`: Launch an instant poll in the channel',
  'guide.cmd.huddleBuilder':
    '• `/pollito huddle`: Open the poll builder targeted to the active Huddle thread in this channel',
  'guide.cmd.huddleInstant':
    '• `/pollito huddle "Question" "Option 1" "Option 2"`: Launch an instant poll inside the active Huddle thread',
  'guide.cmd.close': '• `/pollito close [poll-id]`: Close an active poll you created',
  'guide.cmd.nudge':
    '• `/pollito nudge [poll-id]`: Send private reminders to non-voters',
  'guide.cmd.report': '• `/pollito report`: View your poll results and analytics report',

  // ── Analytics and poll detail modals ──────────────────────────────────
  'analytics.title': 'Poll Analytics',
  'analytics.scope.personal':
    'Your poll results and participation metrics for the *last {days, plural, one {day} other {# days}}*. Only polls you created appear here. Workspace-wide analytics are visible to workspace admins and Pollito managers.',
  'analytics.scope.workspace':
    'Workspace-wide poll results and participation metrics for the *last {days, plural, one {day} other {# days}}*.',
  'analytics.metric.quorum':
    '*Reached quorum*\n*{rate}%* of polls ({count})',
  'analytics.metric.participation':
    '*Avg. Participation*\n*{pct}%* across eligible members',
  'analytics.metric.ballots':
    '*Votes cast*\n{votes, plural, one {*#* vote} other {*#* votes}} across {polls, plural, one {*#* poll} other {*#* polls}}',
  'analytics.metric.privacy':
    '*Public and anonymous*\n*{publicCount}* public • *{anonymousCount}* anonymous',
  'analytics.export.button': 'Customize and export CSV',
  'analytics.recent.header': 'Recent poll results',
  'analytics.empty': 'No polls recorded in this timeframe.',
  'analytics.outcome.none': 'No votes cast',
  'analytics.outcome.tiedLead': 'Tied lead: {options} ({votes})',
  'analytics.outcome.leading': 'Leading: *{option}* ({votes})',
  'analytics.outcome.tie': 'Tie: {options} ({votes})',
  'analytics.outcome.winner': 'Winner: *{option}* ({votes})',
  'analytics.poll.summary':
    'Channel: <#{channelId}> • *{status}* • *{mode}* • {participants, plural, one {*#* participant} other {*#* participants}} • {outcome}',
  'detail.title': 'Poll results breakdown',
  'detail.fallbackQuestion': 'Poll results',
  'detail.mode.anonymous': 'Anonymous',
  'detail.field.channel': '*Channel*\n<#{channelId}>',
  'detail.field.status': '*Status and outcome*\n{status} • {outcome}',
  'detail.field.ballot': '*Ballot mode*\n{mode} • {choice}',
  'detail.field.quorum': '*Quorum and turnout*\n{summary}',
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
  'home.button.launch': 'Launch new poll',
  'home.button.analytics': 'Results and analytics',
  'home.button.templates': 'Templates',
  'home.button.guide': 'Guide',
  'home.button.settings': 'Settings',
  'home.button.exportCsv': 'Export CSV',
  'home.button.docs': 'Documentation',
  'home.button.manageHistory': 'Select polls to delete',
  'home.button.clearClosed': 'Clear closed polls',
  'home.button.viewResults': 'View results',
  'home.stat.active': '*{count}*\nActive polls',
  'home.stat.quorums': '*{count}*\nQuorums reached',
  'home.stat.closed': '*{count}*\nClosed polls',
  'home.stat.participation': '*{pct}%*\nAverage participation',
  'home.templates.intro': '*Quick Templates*\nLaunch a pre-configured team poll in one click.',
  'home.templates.emptyManager':
    '*Quick Templates*\nNo workspace templates yet. As an admin, you can create quick templates for your team to launch in one click.',
  'home.templates.emptyMember':
    '*Quick Templates*\nNo templates have been shared with the workspace yet. Open *Templates* above to create your own.',
  'home.templates.add': '+ Add template',
  'home.templates.addWorkspace': '+ Add workspace template',
  'home.recent.header': 'Recent polls',
  'home.recent.empty':
    '_No polls yet. Type `/pollito` in any channel or click "Launch New Poll" above._',
  'home.recent.meta':
    '<#{channelId}> • {votes, plural, one {# vote} other {# votes}} • {status}{role}',
  'home.role.creator': ' • You created this',
  'home.role.participant': ' • Participant',
  'home.delete.confirmTitle': 'Delete this poll?',
  'home.delete.confirmBody':
    'This permanently removes the poll record from App Home and workspace analytics.',
  'home.clear.confirmTitle': 'Clear closed polls?',
  'home.clear.confirmBody': 'This permanently removes finished polls from your App Home history.',
  'home.footer': 'Public and anonymous polls • Quorum & Huddle thread support',

  // ── CSV export and history modals ─────────────────────────────────────
  'csv.title': 'Export polls CSV',
  'csv.intro':
    'Filter your poll records by date, status, or specific questions, then copy the CSV data below:',
  'csv.status.all': 'All poll statuses',
  'csv.status.quorumReached': 'Quorum reached only',
  'csv.status.closed': 'Closed polls only',
  'csv.status.active': 'Active polls only',
  'csv.startDate.placeholder': 'Select start date',
  'csv.startDate.label': 'Start date (optional)',
  'csv.endDate.placeholder': 'Select end date',
  'csv.endDate.label': 'End date (optional)',
  'csv.statusFilter.label': 'Poll status filter',
  'csv.polls.placeholder': 'All polls in range (or pick specific polls)',
  'csv.polls.label': 'Specific polls to export',
  'csv.apply': 'Apply filters',
  'history.title': 'Manage poll history',
  'history.submit': 'Delete selected',
  'history.intro':
    'Select one or more polls to permanently remove from App Home history and analytics:',
  'history.placeholder': 'Choose polls to delete',
  'history.label': 'Polls to delete',

  // ── Templates modal ───────────────────────────────────────────────────
  'templates.title': 'Poll templates',
  'templates.intro':
    'Save recurring team questions, quorum rules, and ballot settings as reusable poll templates.',
  'templates.button.newWorkspace': '+ Create workspace template',
  'templates.button.new': '+ New template',
  'templates.tab.mine': 'My templates ({count})',
  'templates.tab.workspace': 'Workspace templates ({count})',
  'templates.delete.prompt': '*Delete template "{name}"?*\nThis action cannot be undone.',
  'templates.delete.fallbackName': 'Selected template',
  'templates.delete.confirm': 'Confirm deletion',
  'templates.menu.launch': 'Launch poll',
  'templates.menu.edit': 'Edit template',
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
  'settings.title': 'Workspace settings',
  'settings.submit': 'Save settings',
  'settings.readOnly.body':
    '*Read-only view*\nWorkspace settings can only be changed by Slack admins and Pollito managers.',
  'settings.value.concurrencyMultiple': 'Multiple active polls allowed',
  'settings.value.concurrencySingle': 'Only 1 active poll per channel',
  'settings.value.privacyAnonymous': 'Anonymous',
  'settings.value.privacyPublic': 'Public',
  'settings.value.quorumNone': 'No quorum',
  'settings.value.nudgesEnabled': 'Enabled (up to {max} channel members)',
  'settings.value.nudgesDisabled': 'Disabled',
  'settings.value.managersNone': 'None configured',
  'settings.value.localeAuto': 'Automatic (follows each Slack language)',
  'settings.field.concurrency': '*Channel concurrency*\n{value}',
  'settings.field.privacy': '*Default privacy*\n{value}',
  'settings.field.quorum': '*Default quorum*\n{value}',
  'settings.field.nudges': '*Reminders*\n{value}',
  'settings.field.managers': '*Pollito managers*\n{value}',
  'settings.field.locale': '*Workspace language*\n{value}',
  'settings.option.concurrency': '*Allow multiple active polls in one channel*',
  'settings.option.concurrencyHint': 'Unchecked by default: one active poll per channel.',
  'settings.option.anonymous': '*Default to anonymous voting*',
  'settings.option.nudges': '*Let poll creators send reminders to non-voters*',
  'settings.quorum.none': 'No quorum required',
  'settings.quorum.51': '51% (majority)',
  'settings.quorum.66': '66% (two-thirds)',
  'settings.quorum.70': '70% (team consensus)',
  'settings.quorum.75': '75% (high consensus)',
  'settings.quorum.80': '80% (strong majority)',
  'settings.quorum.100': '100% (unanimous)',
  'settings.label.concurrency': 'Channel concurrency',
  'settings.label.privacy': 'Default privacy and reminders',
  'settings.label.quorum': 'Default quorum threshold',
  'settings.label.maxNudge': 'Max channel size for reminders',
  'settings.hint.maxNudge':
    'Channels larger than this member limit will not show the Remind non-voters button.',
  'settings.label.managers': 'Pollito managers',
  'settings.placeholder.managers': 'Select teammates who can manage workspace settings',
  'settings.label.locale': 'Workspace language',
  'settings.hint.locale':
    'Used for people whose Slack language Pollito does not support. Each person otherwise sees Pollito in their own Slack language.',
  'settings.locale.auto': 'Automatic (follow each Slack language)',
  'settings.locale.en': 'English',
  'settings.locale.es': 'Español',

  // ── Create poll and template modal ────────────────────────────────────
  'cp.title.huddle': 'Create a Huddle poll',
  'cp.title.create': 'Create a poll',
  'cp.title.editTemplate': 'Edit poll template',
  'cp.title.newTemplate': 'New poll template',
  'cp.title.newWorkspaceTemplate': 'New workspace template',
  'cp.submit.launch': 'Launch poll',
  'cp.submit.saveTemplate': 'Save template',
  'cp.submit.createTemplate': 'Create template',
  'cp.huddle.inChannel': ' in <#{channelId}>',
  'cp.huddle.bannerActive':
    '🎧 *Target: Active Huddle Thread*{inChannel}\nThis poll will be posted directly inside the live Huddle thread.',
  'cp.huddle.bannerPending':
    '🎧 *Target: Huddle Thread*{inChannel}\nPollito will auto-detect the active Huddle on launch, or you can paste the Huddle message link below.',
  'cp.channel.placeholder': 'Choose channel',
  'cp.channel.label': 'Channel',
  'cp.channel.labelTemplate': 'Default channel (optional)',
  'cp.huddleThread.placeholder': 'Leave blank to auto-detect active Huddle, or paste Huddle message link',
  'cp.huddleThread.label': 'Huddle thread link or timestamp',
  'cp.question.placeholder': 'e.g. Which sprint retrospective date works best?',
  'cp.question.label': 'Poll question',
  'cp.option.label': 'Option {number}',
  'cp.option.placeholder1': 'First option',
  'cp.option.placeholder2': 'Second option',
  'cp.option.placeholder3': 'Third option (optional)',
  'cp.option.placeholder4': 'Fourth option (optional)',
  'cp.settings.label': 'Poll settings',
  'cp.settings.anonymous': '*Anonymous voting*',
  'cp.settings.anonymousHint': 'Nobody can see who voted for what.',
  'cp.settings.multiple': '*Multiple choice*',
  'cp.settings.multipleHint': 'Allow teammates to select more than one option.',
  'cp.settings.noQuorum': '*No quorum required*',
  'cp.settings.noQuorumHint': 'No participation threshold. Closes manually or on deadline.',
  'cp.settings.forwardHuddle': '*Remind in channel when Huddle ends*',
  'cp.settings.forwardHuddleHint': 'Posts a vote reminder link in the channel when the Huddle ends.',
  'cp.quorum.label': 'Target quorum percentage (%)',
  'cp.quorum.hint':
    'Minimum 51% (more than half). Leave blank or check "No quorum required" above for casual polls.',
  'cp.duration.none': 'No time limit (manual or quorum only)',
  'cp.duration.15m': '15 minutes (Quick Standup)',
  'cp.duration.1h': '1 hour',
  'cp.duration.4h': '4 hours',
  'cp.duration.24h': '24 hours (1 day)',
  'cp.duration.72h': '3 days (72 hours)',
  'cp.duration.7d': '1 week (7 days)',
  'cp.duration.placeholder': 'Select closing duration',
  'cp.duration.label': 'Poll duration or deadline',
  'cp.duration.hint':
    'Automatically closes the vote when this time expires, even if quorum has not been reached.',
  'cp.template.name.placeholderNew': 'e.g. Daily Standup Blockers',
  'cp.template.name.placeholderOptional': 'Optional template name (defaults to question)',
  'cp.template.name.label': 'Template name',
  'cp.template.availability.label': 'Workspace availability',
  'cp.template.save.label': 'Reusable template',
  'cp.template.save': '*Save as reusable template (only you can see it)*',
  'cp.template.saveHint': 'Stores the question, options, and quorum in your Templates.',
  'cp.template.share': '*Share with workspace*',
  'cp.template.shareHint': 'Teammates can launch it from App Home and Templates.',
} as const;
