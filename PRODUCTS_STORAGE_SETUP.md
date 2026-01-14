# Products Storage Bucket Setup

## Step 1: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `products`
3. Set it to **Private** (not public)

## Step 2: Add Storage Policies

Run the following SQL in Supabase SQL Editor:

```sql
-- Allow authenticated users to read product files (for downloads after purchase verification)
-- Note: The API verifies order ownership before generating signed URLs
DROP POLICY IF EXISTS "Authenticated users can read product files" ON storage.objects;
CREATE POLICY "Authenticated users can read product files"
ON storage.objects FOR SELECT
USING (bucket_id = 'products' AND auth.role() = 'authenticated');

-- Allow admins to upload product files
DROP POLICY IF EXISTS "Admins can upload product files" ON storage.objects;
CREATE POLICY "Admins can upload product files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to update/delete product files
DROP POLICY IF EXISTS "Admins can manage product files" ON storage.objects;
CREATE POLICY "Admins can manage product files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'products' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## Security Notes

- **Private bucket**: Files are not publicly accessible
- **Download verification**: The `/api/downloads/[productId]` endpoint verifies that:
  - User has a completed order containing the product
  - Order belongs to the authenticated user (or guest email matches)
- **Signed URLs**: Downloads use time-limited signed URLs (1 hour expiry) generated server-side
- **Admin only uploads**: Only admins can upload/manage product files through the admin interface

## File Organization

Files are organized within the bucket using prefixes:
- **Products**: `product-${productId}/${fileName}` or `uploads/${fileName}`

This keeps product files organized and makes it easy to manage files per product.
