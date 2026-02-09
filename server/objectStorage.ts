import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export async function uploadFile(
  bucketName: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(fileBuffer, {
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  await file.makePublic();

  return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}

export async function deleteFile(
  bucketName: string,
  fileName: string
): Promise<void> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(fileName);
  await file.delete();
}

export async function getSignedUrl(
  bucketName: string,
  fileName: string,
  expiresIn: number = 3600
): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: fileName,
    method: "GET",
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
  
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export async function uploadFilePrivate(
  bucketName: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(fileBuffer, {
    contentType,
    metadata: {
      cacheControl: "private, max-age=0",
    },
  });

  return fileName;
}

export async function downloadFile(
  bucketName: string,
  fileName: string
): Promise<Buffer> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(fileName);
  const [buffer] = await file.download();
  return buffer;
}
