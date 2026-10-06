export type DropStatus = 'scheduled' | 'live' | 'locked' | 'printing' | 'shipped';
export type DesignStatus =
  | 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'rejected'
  | 'live' | 'won' | 'lost' | 'withdrawn';
export type OrderType = 'backing' | 'retail';
export type OrderStatus =
  | 'pending' | 'backed' | 'won' | 'released' | 'paid' | 'printing'
  | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'failed';
export type PaymentStatus = 'created' | 'authorized' | 'captured' | 'released' | 'refunded' | 'failed';
export type PriceType = 'backer' | 'full' | 'retail';

export interface Settings {
  backer_price: number;
  retail_price: number;
  backer_threshold: number;
  winners_per_drop: number;
  cause_pct_of_profit: number;
  artist_pct: number;
  unit_cost: number;
  shipping_cost: number;
  gateway_fee_pct: number;
  gst_pct: number;
  shipping_fee: number;
  free_shipping_over: number;
  retail_window_days: number;
  max_designs_per_artist: number;
  designs_per_drop: number;
  votes_per_hour: number;
  milestone_heads_up: number;
  lock_time: string;
  print_time: string;
  sizes: string[];
  categories: string[];
  support_email: string;
  require_phone_for_votes: boolean;
  admin_emails: string[];
  referral_reward: number;
  welcome_reward: number;
  return_window_days: number;
  reopen_days: number;
  topic_lead_days: number;
  review_days: number;
  topic_time: string;
}

export interface Profile {
  id: string;
  handle: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  links: { label: string; url: string }[];
  is_artist: boolean;
  is_admin: boolean;
  banned: boolean;
  notify: { push: boolean; email: boolean; whatsapp: boolean };
  created_at: string;
}

export interface Cause {
  id: string;
  name: string;
  description: string | null;
  partner_id: string | null;
  image_url: string | null;
  active: boolean;
}

export interface Drop {
  id: string;
  number: number;
  status: DropStatus;
  opens_at: string;
  locks_at: string;
  prints_at: string;
  cause_id: string | null;
  locked_at: string | null;
  topic_at: string;
  submissions_close_at: string;
}

export interface DropTopic {
  drop_id: string;
  title: string;
  brief: string | null;
  prompts: string[];
  image_url: string | null;
}

/** Where a drop is in its cycle right now. */
export type DropPhase = 'upcoming' | 'submissions' | 'review' | 'voting' | 'locked' | 'printing' | 'shipped';

export interface Colourway {
  name: string;
  hex: string;
  art?: string;
}

export interface Design {
  id: string;
  slug: string;
  artist_id: string;
  drop_id: string | null;
  name: string;
  story: string | null;
  category: string;
  tags: string[];
  colours: Colourway[];
  art_front_url: string;
  art_back_url: string | null;
  perk: string | null;
  originality_confirmed: boolean;
  submitted_for: string | null;
  status: DesignStatus;
  review_note: string | null;
  vote_count: number;
  count_reached_at: string;
  backer_count: number;
  final_rank: number | null;
  retail_until: string | null;
  created_at: string;
}

export type DesignWithArtist = Design & { artist: Pick<Profile, 'id' | 'handle' | 'name' | 'avatar_url'> | null };

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pin: string;
  is_default: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  design_id: string;
  colour: string;
  size: string;
  qty: number;
  unit_price: number;
  price_type: PriceType;
  design?: Pick<Design, 'id' | 'slug' | 'name' | 'colours' | 'art_front_url' | 'status'> | null;
}

export interface Order {
  id: string;
  number: number;
  user_id: string;
  type: OrderType;
  status: OrderStatus;
  drop_id: string | null;
  ship_to: Omit<Address, 'id' | 'is_default' | 'label'>;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  gst_included: number;
  payment_status: PaymentStatus;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  payment_method: string | null;
  authorized_at: string | null;
  captured_at: string | null;
  released_at: string | null;
  created_at: string;
  discount_code: string | null;
  source: string | null;
  items?: OrderItem[];
  shipment?: { carrier: string | null; awb: string | null; tracking_url: string | null; shipped_at: string | null; delivered_at: string | null } | null;
}

export interface Post {
  id: string;
  author_id: string | null;
  kind: 'member' | 'artist' | 'system';
  body: string;
  image_urls: string[];
  design_id: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  created_at: string;
  author?: Pick<Profile, 'id' | 'handle' | 'name' | 'avatar_url' | 'is_artist'> | null;
  design?: Pick<Design, 'id' | 'slug' | 'name' | 'colours' | 'art_front_url' | 'vote_count' | 'status'> | null;
}

export interface Comment {
  id: string;
  post_id: string | null;
  design_id: string | null;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'handle' | 'name' | 'avatar_url' | 'is_artist'> | null;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CartLine {
  designId: string;
  slug: string;
  name: string;
  colour: string;
  size: string;
  qty: number;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  kind: 'exchange' | 'return';
  reason: 'size' | 'damaged' | 'misprint' | 'wrong_item' | 'other';
  new_size: string | null;
  details: string | null;
  photo_urls: string[];
  status: 'open' | 'approved' | 'rejected' | 'completed';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Review {
  id: string;
  order_item_id: string;
  design_id: string;
  user_id: string;
  rating: number;
  fit: 'small' | 'true' | 'large' | null;
  size: string | null;
  body: string | null;
  photo_urls: string[];
  created_at: string;
  author?: Pick<Profile, 'id' | 'handle' | 'name' | 'avatar_url'> | null;
}
