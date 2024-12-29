import { promises as fsPromises, Dirent } from 'fs';
import { join, extname } from 'path';

export const musicExtension = ["wav", "bwf", "raw", "aiff", "flac", "m4a", "pac", "tta", "wv", "ast",
    "aac", "mp2", "mp3", "mp4", "amr", "s3m", "3gp", "act", "au", "dct", "dss", "gsm", "m4p",
    "mmf", "mpc", "ogg", "oga", "opus", "ra", "sln", "vox"]
export const videoExtension = ["3g2", "3gp", "aaf", "asf", "avchd", "avi", "drc", "flv", "m2v", "m3u8",
    "m4p", "m4v", "mkv", "mng", "mov", "mp2", "mp4", "mpe", "mpeg", "mpg", "mpv", "mxf", "nsv",
    "ogg", "ogv", "qt", "rm", "rmvb", "roq", "svi", "vob", "webm", "wmv", "yuv"]

export const extension = [...musicExtension, ...videoExtension]

export async function walkDirWithMergedArray(dir: string, extensions: string[]): Promise<string[]> {
    const stack: string[] = [dir];
    const result: string[] = []; // This will store the full paths of .txt files

    while (stack.length > 0) {
        const currentDir = stack.pop()!;
        const files = await fsPromises.readdir(currentDir, { withFileTypes: true });

        // Process the files in the current directory
        const dirs: string[] = [];
        for (const file of files) {
            const fullPath = join(currentDir, file.name);
            if (file.isDirectory()) {
                dirs.push(fullPath); // Push subdirectory to stack for later traversal
            } else {
                const fileExtension = extname(fullPath).toLowerCase();
                if (extensions.some(ext => fileExtension === `.${ext.toLowerCase()}`)) {
                    result.push(fullPath); // Add full path to the result array
                  }
            }
        }

        // Add subdirectories to the stack for future exploration
        stack.push(...dirs);
    }

    return result; // Return the merged array of full file paths
}

export function extractDigits(path: string): number[] {
    // Use a regular expression to find all digits in the path
    const digits = path.match(/\d+/g);
    // Convert the found digits to integers and return them as an array
    return digits ? digits.map(Number) : [];
  }

export function sortDirectory(result: string[]){
    return result.sort((a, b) => {
        const digitsA = extractDigits(a);
        const digitsB = extractDigits(b);
    
        // Compare arrays of digits lexicographically (like sorting based on extracted numbers)
        for (let i = 0; i < Math.min(digitsA.length, digitsB.length); i++) {
          if (digitsA[i] !== digitsB[i]) {
            return digitsA[i] - digitsB[i]; // Sorting by the first differing number
          }
        }
    
        // If one array is a prefix of the other, compare their lengths
        return digitsA.length - digitsB.length;
      });
}

export async function sortedWalkDirWithMergedArray(dir: string,  extensions: string[]) {
    const result = await walkDirWithMergedArray(dir, extensions)
    return result;
}