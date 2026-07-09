import { Contact, AVATAR_COLORS } from "../types";

// List connections from Google Contacts
export async function fetchGoogleContacts(accessToken: string): Promise<Contact[]> {
  const url = "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=100";
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Contacts Fetch Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const connections = data.connections || [];

  return connections.map((conn: any) => {
    const nameObj = conn.names?.[0];
    const name = nameObj?.displayName || nameObj?.unstructuredName || "Unnamed Contact";
    const phone = conn.phoneNumbers?.[0]?.value || "";
    const email = conn.emailAddresses?.[0]?.value || "";

    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    return {
      id: conn.resourceName, // Use resourceName as unique ID
      name,
      phone,
      email,
      resourceName: conn.resourceName,
      etag: conn.etag,
      isGoogleContact: true,
      avatarColor: randomColor,
    };
  });
}

// Create a contact in Google Contacts
export async function createGoogleContact(
  accessToken: string,
  contact: { name: string; phone: string; email: string }
): Promise<{ resourceName: string; etag: string }> {
  const url = "https://people.googleapis.com/v1/people:createContact";
  const body = {
    names: [{ givenName: contact.name }],
    phoneNumbers: [{ value: contact.phone, type: "mobile" }],
    emailAddresses: [{ value: contact.email, type: "home" }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Contacts Create Error (${res.status}): ${errText}`);
  }

  const data = await res.ok ? await res.json() : {};
  return {
    resourceName: data.resourceName || "",
    etag: data.etag || "",
  };
}

// Update a contact in Google Contacts
export async function updateGoogleContact(
  accessToken: string,
  resourceName: string,
  etag: string,
  contact: { name: string; phone: string; email: string }
): Promise<{ etag: string }> {
  const url = `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers`;
  const body = {
    etag,
    names: [{ givenName: contact.name }],
    phoneNumbers: [{ value: contact.phone, type: "mobile" }],
    emailAddresses: [{ value: contact.email, type: "home" }],
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Contacts Update Error (${res.status}): ${errText}`);
  }

  const data = await res.ok ? await res.json() : {};
  return {
    etag: data.etag || "",
  };
}

// Delete a contact in Google Contacts
export async function deleteGoogleContact(accessToken: string, resourceName: string): Promise<void> {
  const url = `https://people.googleapis.com/v1/${resourceName}:deleteContact`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Contacts Delete Error (${res.status}): ${errText}`);
  }
}
