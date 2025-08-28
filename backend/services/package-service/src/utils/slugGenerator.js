const slugify = require('slugify');
const db = require('./database');

/**
 * Generate unique slug for package
 */
const generatePackageSlug = async (name, producerId, existingSlug = null) => {
    try {
        // Create base slug from name
        let baseSlug = slugify(name, {
            lower: true,
            strict: true, // Remove special characters
            locale: 'it'
        });

        // Ensure slug is not too long
        if (baseSlug.length > 100) {
            baseSlug = baseSlug.substring(0, 100).replace(/-$/, '');
        }

        // If this is an update and slug hasn't changed, keep existing
        if (existingSlug && existingSlug.startsWith(baseSlug)) {
            const existingCheck = await db.query(
                'SELECT id FROM packages WHERE slug = $1 AND producer_id = $2',
                [existingSlug, producerId]
            );
            
            if (existingCheck.rows.length <= 1) {
                return existingSlug;
            }
        }

        let finalSlug = baseSlug;
        let counter = 1;

        // Check for uniqueness within producer's packages
        while (true) {
            const result = await db.query(
                'SELECT id FROM packages WHERE slug = $1 AND producer_id = $2',
                [finalSlug, producerId]
            );

            if (result.rows.length === 0) {
                break; // Slug is unique
            }

            // Generate next variant
            counter++;
            finalSlug = `${baseSlug}-${counter}`;
        }

        return finalSlug;

    } catch (error) {
        console.error('Error generating package slug:', error);
        
        // Fallback to UUID-based slug
        const { v4: uuidv4 } = require('uuid');
        const fallbackSlug = `package-${uuidv4().substring(0, 8)}`;
        
        console.log(`Using fallback slug: ${fallbackSlug}`);
        return fallbackSlug;
    }
};

/**
 * Validate slug format
 */
const validateSlug = (slug) => {
    const errors = [];

    if (!slug) {
        errors.push('Slug è richiesto');
        return { valid: false, errors };
    }

    // Check length
    if (slug.length < 3) {
        errors.push('Slug deve essere almeno 3 caratteri');
    }

    if (slug.length > 100) {
        errors.push('Slug non può superare 100 caratteri');
    }

    // Check format
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugPattern.test(slug)) {
        errors.push('Slug può contenere solo lettere minuscole, numeri e trattini');
    }

    // Check for reserved words
    const reservedWords = [
        'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'new', 'edit', 'delete',
        'create', 'update', 'search', 'featured', 'popular', 'categories'
    ];
    
    if (reservedWords.includes(slug)) {
        errors.push(`Slug "${slug}" è una parola riservata`);
    }

    // Check that it doesn't start or end with hyphen
    if (slug.startsWith('-') || slug.endsWith('-')) {
        errors.push('Slug non può iniziare o finire con un trattino');
    }

    // Check for consecutive hyphens
    if (slug.includes('--')) {
        errors.push('Slug non può contenere trattini consecutivi');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Generate SEO-friendly slug with keywords
 */
const generateSEOSlug = (name, wineTypes = [], difficulty = null) => {
    try {
        let slugParts = [];

        // Add wine types if provided
        if (wineTypes && wineTypes.length > 0) {
            const wineTypeSlug = wineTypes.slice(0, 2).join('-');
            slugParts.push(wineTypeSlug);
        }

        // Add main name
        const nameSlug = slugify(name, {
            lower: true,
            strict: true,
            locale: 'it'
        });
        slugParts.push(nameSlug);

        // Add difficulty level
        if (difficulty && difficulty !== 'beginner') {
            slugParts.push(difficulty);
        }

        // Join parts
        let seoSlug = slugParts.join('-');

        // Ensure reasonable length
        if (seoSlug.length > 100) {
            seoSlug = seoSlug.substring(0, 100).replace(/-[^-]*$/, '');
        }

        return seoSlug;

    } catch (error) {
        console.error('Error generating SEO slug:', error);
        return slugify(name, { lower: true, strict: true });
    }
};

/**
 * Update slug if needed
 */
const updateSlugIfNeeded = async (packageId, currentName, currentSlug, producerId) => {
    try {
        // Generate what the slug should be based on current name
        const expectedSlug = slugify(currentName, {
            lower: true,
            strict: true,
            locale: 'it'
        });

        // If current slug is still appropriate, keep it
        if (currentSlug.startsWith(expectedSlug)) {
            return currentSlug;
        }

        // Generate new unique slug
        const newSlug = await generatePackageSlug(currentName, producerId);

        // Update in database
        await db.query(
            'UPDATE packages SET slug = $1 WHERE id = $2',
            [newSlug, packageId]
        );

        console.log(`Updated slug for package ${packageId}: ${currentSlug} -> ${newSlug}`);
        return newSlug;

    } catch (error) {
        console.error('Error updating slug:', error);
        return currentSlug; // Return existing slug if update fails
    }
};

/**
 * Get slug suggestions
 */
const getSlugSuggestions = (name, wineTypes = [], difficulty = null) => {
    const suggestions = [];

    try {
        // Basic slug
        const basic = slugify(name, { lower: true, strict: true });
        suggestions.push(basic);

        // With wine type
        if (wineTypes.length > 0) {
            const withWine = `${wineTypes[0]}-${basic}`;
            suggestions.push(slugify(withWine, { lower: true, strict: true }));
        }

        // With difficulty
        if (difficulty) {
            const withDifficulty = `${basic}-${difficulty}`;
            suggestions.push(slugify(withDifficulty, { lower: true, strict: true }));
        }

        // Shortened version
        if (basic.length > 20) {
            const words = basic.split('-');
            const shortened = words.slice(0, 3).join('-');
            suggestions.push(shortened);
        }

        // Remove duplicates and return unique suggestions
        return [...new Set(suggestions)].slice(0, 5);

    } catch (error) {
        console.error('Error generating slug suggestions:', error);
        return [slugify(name, { lower: true, strict: true })];
    }
};

/**
 * Check if slug exists globally (across all producers)
 */
const checkSlugGlobalUniqueness = async (slug) => {
    try {
        const result = await db.query(
            'SELECT id, producer_id FROM packages WHERE slug = $1',
            [slug]
        );

        return {
            exists: result.rows.length > 0,
            packages: result.rows
        };

    } catch (error) {
        console.error('Error checking slug global uniqueness:', error);
        return { exists: true, packages: [] }; // Assume exists on error for safety
    }
};

/**
 * Batch update slugs for existing packages
 */
const batchUpdateSlugs = async (producerId, dryRun = true) => {
    try {
        const packages = await db.query(
            'SELECT id, name, slug FROM packages WHERE producer_id = $1 ORDER BY created_at ASC',
            [producerId]
        );

        const updates = [];

        for (const pkg of packages.rows) {
            const currentSlug = pkg.slug;
            const newSlug = await generatePackageSlug(pkg.name, producerId);

            if (currentSlug !== newSlug) {
                updates.push({
                    id: pkg.id,
                    name: pkg.name,
                    old_slug: currentSlug,
                    new_slug: newSlug
                });

                if (!dryRun) {
                    await db.query(
                        'UPDATE packages SET slug = $1 WHERE id = $2',
                        [newSlug, pkg.id]
                    );
                }
            }
        }

        return {
            total_packages: packages.rows.length,
            updates_needed: updates.length,
            updates: updates,
            dry_run: dryRun
        };

    } catch (error) {
        console.error('Error in batch slug update:', error);
        throw error;
    }
};

module.exports = {
    generatePackageSlug,
    validateSlug,
    generateSEOSlug,
    updateSlugIfNeeded,
    getSlugSuggestions,
    checkSlugGlobalUniqueness,
    batchUpdateSlugs
};