
/**
 * Vercel Blob Storage Service
 * Handles cloud-native object storage for unstructured data and persistence shards.
 * Note: Requires BLOB_READ_WRITE_TOKEN.
 */
export class VercelBlobService {
  private baseUrl = 'https://blob.vercel-storage.com';

  constructor(private token: string) {
    if (!token) throw new Error("Vercel Blob Token is required for cloud storage.");
  }

  /**
   * Puts an object into Vercel Blob.
   * Directly implements the behavior requested: put(path, content, { access: 'public' })
   */
  async put(path: string, content: string | Blob, access: 'public' = 'public') {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'x-api-version': '6',
        'x-add-random-suffix': 'true',
      },
      body: content,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Blob Storage Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Lists blobs in the store.
   */
  async list(limit: number = 20) {
    const response = await fetch(`${this.baseUrl}?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'x-api-version': '6',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Blob List Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Deletes a blob by URL.
   */
  async del(url: string) {
    const response = await fetch(`${this.baseUrl}/delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'x-api-version': '6',
      },
      body: JSON.stringify({ urls: [url] }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Blob Deletion Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }
}
