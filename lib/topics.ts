import { supabase } from './supabase';
import type { Topic } from './supabase';

export async function getTopics() {
  const { data: topics, error } = await supabase
    .from('topics')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return topics;
}

export async function getUserTopics(userId: string) {
  const { data: userTopics, error } = await supabase
    .from('user_topics')
    .select(`
      topic_id,
      topics (*)
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  return userTopics?.map(ut => ut.topics) || [];
}

export async function subscribeTopic(userId: string, topicId: string) {
  const { error } = await supabase
    .from('user_topics')
    .insert({ user_id: userId, topic_id: topicId });
  
  if (error) throw error;
}

export async function unsubscribeTopic(userId: string, topicId: string) {
  const { error } = await supabase
    .from('user_topics')
    .delete()
    .eq('user_id', userId)
    .eq('topic_id', topicId);
  
  if (error) throw error;
}