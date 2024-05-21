import { Logger } from '@nestjs/common';
import { ErrorHandlingService } from '../error-handling/error-handling-service';

export type Quota = {
  limit: string;
  usage: string;
  usageInDrive: string;
  usageInDriveTrash: string;
}

export async function getStorageQuota(drive): Promise<Quota> {
  try {
    const res = await drive.about.get({ fields: 'storageQuota' });
    return res.data.storageQuota;
  } catch (error) {
    console.error('Error getting storage quota:', error);
    return null;
  }
}

async function listFiles(drive) {
  try {
    const files = [];
    let pageToken: string | undefined = undefined;

    do {
      const res = await drive.files.list({
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, size, modifiedTime)',
        q: "mimeType != 'application/vnd.google-apps.folder'",
        orderBy: 'modifiedTime asc',
        pageToken: pageToken
      });

      files.push(...(res.data.files || []));
      Logger.log(`Loading chunk`)
      pageToken = res.data.nextPageToken;
      if (files.length > 10_000) {
        break;
      }
    } while (pageToken);

    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

async function deleteFiles(drive, files: { id: string, name: string, size: number }[]) {
  try {
    for (const file of files) {
      try {
        await drive.files.delete({ fileId: file.id });
      } catch (error) {
        ErrorHandlingService.handleError({error});
      }

      console.log(`File ${file.name} deleted.`);
    }
  } catch (error) {
    console.error('Error deleting files:', error);
  }
}

export async function cleanup(drive) {
  const quota = await getStorageQuota(drive);
  if (!quota) return;

  console.log('Storage Quota:', quota);

  const files = await listFiles(drive);
  let totalSizeToDelete = 0;
  const filesToDelete: { id: string, name: string, size: number }[] = [];

  for (const file of files) {
    if (totalSizeToDelete >= 5 * 1024 * 1024 * 1024) break;
    if (file.size) {
      totalSizeToDelete += Number(file.size);
      filesToDelete.push({ id: file.id!, name: file.name!, size: Number(file.size) });
    }
  }

  console.log(`Total size to delete: ${(totalSizeToDelete / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  await deleteFiles(drive, filesToDelete);
}
