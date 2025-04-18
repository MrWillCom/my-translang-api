# TransLang API

A simple translation API that acts as a proxy for Google Translate, built with [Deno](https://deno.land/) and [Hono](https://hono.dev/).

## Features

- REST API with both GET and POST endpoints
- CORS enabled

## Installation

1. Make sure you have [Deno](https://deno.land/) installed on your system.
2. Clone this repository.

## Usage

### Start the server

```bash
# Development mode (with auto-reload)
deno task dev

# Debug mode
deno task debug

# Production mode
deno task start
```

The server will run on `http://localhost:8000` by default.

## API Endpoints

### List Available Endpoints

```
GET /
```

Returns a list of available API endpoints.

### Translate Text

#### GET Method

```
GET /api/v1/translate?text=Hello&sl=en&tl=fr
```

Parameters:
- `text`: The text to translate (required)
- `sl`: Source language code (optional, defaults to 'auto' for auto-detection)
- `tl`: Target language code (optional, defaults to 'en')

#### POST Method

```
POST /api/v1/translate
```

Accepts both JSON and form data:

JSON format:
```json
{
  "text": "Hello",
  "sl": "en",
  "tl": "fr"
}
```

Form data:
- `text`: The text to translate
- `sl`: Source language code
- `tl`: Target language code

#### Response Format

```json
{
  "detected_language": "en",
  "translated_text": "Bonjour",
  "pronunciation": null
}
```

### List Supported Languages

```
GET /api/v1/languages
```

Returns a JSON object with all supported source (`sl`) and target (`tl`) languages.

## Cache

Translations are cached for one week to improve performance and reduce API calls.

## Development

### Available Tasks

- `deno task dev`: Run the server in development mode with auto-reload
- `deno task debug`: Run the server in debug mode
- `deno task start`: Run the server in production mode
- `deno task fetch-languages`: Update the languages.json file from Google Translate
- `deno task count-languages`: Count the number of supported languages

