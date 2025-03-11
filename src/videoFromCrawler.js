import fs from 'node:fs'; // Use fs/promises for easier async handling

export const getVideoUrls = async () => {
    const dir = './storage/key_value_stores/default';
    const regex = /https?.*mp4/g;
    const results = [];
  
    try {
        // Read files in the directory (async)
        const files = await fs.promises.readdir(dir);

        // Iterate over the files
        for (const file of files) {
            if (file.endsWith('.html')) {
                const filePath = `${dir}/${file}`;
                const content = await fs.promises.readFile(filePath, 'utf8');
                
                // Find matches in the file content
                const found = content.match(regex);
                if (found) {
                    results.push(...found);
                }
            }
        }

        return results; // Return the result after all async operations are completed
    } catch (error) {
        console.error(`Error processing files: ${error.message}`);
        return []; // Return an empty array on error
    }
};

// Usage example:
// const result = await getVideoUrls();
// console.log(result);

// const sexyUrls = await getVideoUrls()
// const random = Math.floor(Math.random() * sexyUrls.length);
// console.log(sexyUrls[random]);