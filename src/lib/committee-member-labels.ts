export const COMMITTEE_HEAD_LABEL = "رئيس اللجنة";
export const COMMITTEE_MEMBER_LABEL = "عضو اللجنة";

export const committeeMemberLabel = (member: { is_head?: boolean | null }) =>
  member.is_head ? COMMITTEE_HEAD_LABEL : COMMITTEE_MEMBER_LABEL;
