// Plain-English one-sentence definitions for advanced stats. Anything not in this
// map renders as a plain header with no help mark — the absence of a tooltip is
// the signal that the stat is self-explanatory (PTS, REB, AST, etc.).
//
// Lower-case keys at the bottom (fieldGoalPct, etc.) are aliases for the ESPN-shaped
// names used in the Game Log table; same definition as their UPPER counterpart above.

export const STAT_DEFINITIONS = {
  FG_PCT:   'Share of all field-goal attempts that went in.',
  FG3_PCT:  'Share of three-point attempts that went in.',
  FT_PCT:   'Share of free throws made.',
  TS_PCT:   'Overall shooting efficiency that gives extra credit for threes and free throws — a single number for "how many points per shot, really."',
  EFG_PCT:  "Field-goal percentage adjusted to count a made three as 1.5 makes, since it's worth 50% more.",
  TPAr:     'Share of her field-goal attempts that came from beyond the arc.',
  FTr:      'How often she gets to the line, measured as free-throw attempts per field-goal attempt.',
  TOV_PCT:  'Estimated share of her offensive possessions that ended in a turnover.',
  USG_PCT:  "Estimated share of her team's possessions she used while on the floor — a proxy for offensive workload.",
  AST_PCT:  "Estimated share of her teammates' made baskets she assisted while on the floor.",
  ORB_PCT:  'Estimated share of available offensive rebounds she grabbed while on the floor.',
  DRB_PCT:  'Estimated share of available defensive rebounds she grabbed while on the floor.',
  TRB_PCT:  'Estimated share of all available rebounds she grabbed while on the floor.',
  STL_PCT:  'Estimated share of opponent possessions she ended with a steal while on the floor.',
  BLK_PCT:  'Estimated share of opponent two-point attempts she blocked while on the floor.',
  PER:      'Per-minute rating that rolls scoring, rebounding, assists, steals, blocks, fouls, and turnovers into one number; league average is 15.',
  OWS:      'Offensive Win Shares — estimated team wins her offense produced this season.',
  DWS:      'Defensive Win Shares — estimated team wins her defense produced this season.',
  WS:       'Total Win Shares — OWS plus DWS, an estimate of wins she contributed all-around.',
  WS_PER48: 'Win Shares scaled to a full 48 minutes — lets you compare starters and rotation players on the same footing; league average is .100.',

  fieldGoalPct:  'Share of all field-goal attempts that went in.',
  threePointPct: 'Share of three-point attempts that went in.',
  freeThrowPct:  'Share of free throws made.',
};
