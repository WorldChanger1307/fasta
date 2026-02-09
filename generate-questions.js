exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { material, numQuestions, apiKey } = JSON.parse(event.body);

    if (!apiKey || !material || !numQuestions) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Based on this study material, generate exactly ${numQuestions} multiple choice questions. Return ONLY a valid JSON array with no additional text. Each question should have: "question" (string), "options" (array of 4 strings), "correct" (number 0-3 for the correct option index). Mix understanding questions with equation solving problems.

Study material:
${material}

Return ONLY the JSON array, starting with [ and ending with ]`,
          },
        ],
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      try {
        const error = JSON.parse(responseText);
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: error.error?.message || responseText }),
        };
      } catch (e) {
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: `HTTP ${response.status}: ${responseText}` }),
        };
      }
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Invalid JSON from API: ${responseText.substring(0, 200)}` }),
      };
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Unexpected API response format' }),
      };
    }

    const content = data.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Could not find JSON in response: ${content.substring(0, 200)}` }),
      };
    }

    const questions = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify({ questions }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server error: ${error.message}` }),
    };
  }
};
