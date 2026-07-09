export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatarColor?: string; // Optional custom background color for the avatar
  resourceName?: string; // Google People API resource name (e.g. people/c1234567)
  etag?: string; // Google People API etag for optimistic concurrency control
  isGoogleContact?: boolean; // True if this contact was fetched from / exists in Google Contacts
}

export const AVATAR_COLORS = [
  "bg-pink-500 text-white",
  "bg-rose-500 text-white",
  "bg-purple-500 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-orange-500 text-white",
  "bg-emerald-500 text-white",
];

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Nirmal Dahit",
    phone: "+977-9800000000",
    email: "dhn.aristoschool@gmail.com",
    avatarColor: "bg-pink-500 text-white",
  },
  {
    id: "2",
    name: "Sita Sharma",
    phone: "+977-9812345678",
    email: "sita.sharma@example.com",
    avatarColor: "bg-teal-500 text-white",
  },
  {
    id: "3",
    name: "Rohan Chaudhary",
    phone: "+977-9843210987",
    email: "rohan.c@example.com",
    avatarColor: "bg-orange-500 text-white",
  },
];
