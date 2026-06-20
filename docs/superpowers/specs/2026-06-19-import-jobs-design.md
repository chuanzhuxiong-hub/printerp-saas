# Import Jobs Design

## Goal

Move large import requests out of foreground HTTP execution and into the existing `BackgroundJob` queue. The first implementation slice covers platform order imports and cost imports.

## Scope

Included in this slice:

- Platform order import jobs (`ORDER_IMPORT`)
- Cost import jobs (`COST_IMPORT`)
- Upload file persistence under a controlled job upload directory
- Worker processors that read the saved file and execute the existing import logic
- Job result summaries with imported/matched/skipped/invalid counts

Deferred to the next slice:

- Product competitor CSV import jobs
- Product opportunity CSV import jobs
- AI title/detail/image generation jobs
- Rich progress percentages and per-row error reports

## Architecture

HTTP import APIs keep validating file type and size, then save the uploaded file under `uploads/jobs/<tenantId>/<jobId>/`. They enqueue a `BackgroundJob` with the file path, original file name, user id and import options, then redirect the user to `/app/jobs`.

The worker process reads the persisted file and calls import service functions. These services contain the business logic that previously lived directly inside route handlers. Keeping import logic in service files lets both route tests and background workers verify the same behavior.

## Data Flow

1. User uploads an order or cost import file.
2. API validates the file and creates a `BackgroundJob`.
3. API saves the file to disk and updates the job payload with `filePath`.
4. User is redirected to task center.
5. Worker claims the job and invokes `ORDER_IMPORT` or `COST_IMPORT`.
6. Processor reads the file, performs the import and stores summary data in `BackgroundJob.result`.

## Error Handling

Validation errors before enqueue still return immediately. Import errors after enqueue mark the job as failed and preserve the error message in the job record.

## Testing

Add a focused test that verifies:

- Import job payload validation rejects missing file paths.
- `ORDER_IMPORT` and `COST_IMPORT` processors are registered.
- Import routes no longer perform synchronous parsing directly.
- The job upload helper writes files under `uploads/jobs`.
