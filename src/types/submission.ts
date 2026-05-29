export interface Submission {
  id: string;
  type: 'photo' | 'message' | 'video';
  content: string; // URL for photo/video, text for message
  name: string; // submitter's name
  timestamp: number;
  shown: boolean;
}
