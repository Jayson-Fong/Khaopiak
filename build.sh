#!/bin/sh

BASE_FOLDER="$(dirname "$(realpath "$0")")"
TEMPLATE_FOLDER="$BASE_FOLDER/public-templates"
ASSETS_FOLDER="$BASE_FOLDER/public-templates/assets"
TARGET_FOLDER="$BASE_FOLDER/public"

rm -rf "${TARGET_FOLDER:?}"/*

asset_files=$(ls "$ASSETS_FOLDER")

for asset_file in $asset_files; do
  cp "$ASSETS_FOLDER/$asset_file" "$TARGET_FOLDER/$asset_file"
done

template_files=$(find "$TEMPLATE_FOLDER" -maxdepth 1 -type f)

for template_file in $template_files; do
  template_file=$(basename "$template_file")
  template_file_contents=$(cat "$TEMPLATE_FOLDER/$template_file")

  integrity_checks=$(grep -o -E "%%INTEGRITY:[a-zA-Z0-9_.-]+%%" "$TEMPLATE_FOLDER/$template_file")
  for integrity_check in $integrity_checks; do
    integrity_check_file_name=$(printf "%s" "$integrity_check" | cut -c "13-$((${#integrity_check}-2))")

    integrity_sha512=$(openssl dgst -binary -sha512 "$ASSETS_FOLDER/$integrity_check_file_name" | base64)
    integrity_check_string="sha512-$integrity_sha512"
    template_file_contents=$(echo "$template_file_contents" | sed "s#$integrity_check#$integrity_check_string#")
  done

  echo "$template_file_contents" > "$TARGET_FOLDER/$template_file"
done

exit 0