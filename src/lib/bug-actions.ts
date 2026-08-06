import { supabase } from './supabase';

/**
 * Merges comments and attachments from a duplicate child bug to a parent bug,
 * and logs the action in the activity history of both tickets.
 */
export async function mergeDuplicateBug(
  childBugId: string,
  childDisplayId: string,
  parentBugId: string,
  userId: string
) {
  // 1. Fetch comments of child bug
  const { data: comments, error: commentsErr } = await supabase
    .from('bug_comments')
    .select('id, comment')
    .eq('bug_id', childBugId);

  if (!commentsErr && comments && comments.length > 0) {
    // Move comments to parent bug, prepending information about the source ticket
    for (const comment of comments) {
      await supabase
        .from('bug_comments')
        .update({
          bug_id: parentBugId,
          comment: `[Merged from duplicate ${childDisplayId}] ${comment.comment}`
        })
        .eq('id', comment.id);
    }
  }

  // 2. Move attachments of child bug to parent bug
  await supabase
    .from('bug_attachments')
    .update({ bug_id: parentBugId })
    .eq('bug_id', childBugId);

  // 3. Log duplicate linked action on the parent bug's activity timeline
  await supabase
    .from('activity_log')
    .insert({
      bug_id: parentBugId,
      user_id: userId,
      action: 'duplicate_linked',
      old_value: 'None',
      new_value: childDisplayId,
      metadata: { child_bug_id: childBugId }
    });
}
