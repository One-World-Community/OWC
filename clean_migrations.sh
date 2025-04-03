#!/bin/bash

# Create a backup directory
mkdir -p supabase/migrations_backup

# Copy original files to backup
cp supabase/migrations/*.sql supabase/migrations_backup/

# Process each migration file
for file in supabase/migrations/*.sql; do
  echo "Cleaning $file"
  # Replace literal \n characters with actual newlines
  sed -i '' 's/\\n/\n/g' "$file"
done

echo "Migration files cleaned. Originals backed up in supabase/migrations_backup/" 