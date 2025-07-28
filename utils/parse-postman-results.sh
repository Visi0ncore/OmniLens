#!/bin/bash

# Simple Postman Results Parser
# Extracts failure details from Postman JSON output
# Usage: ./parse-postman-results.sh <test_name> <step_outcome> <json_files...>

test_name="$1"
step_outcome="$2"
shift 2
json_files=("$@")

# Function to sanitize output for GitHub Actions
sanitize_output() {
    # Remove problematic characters and filter out JSONError garbage
    while IFS= read -r line; do
        # Skip JSONError lines entirely
        if [[ "$line" =~ ^JSONError ]]; then
            echo "• JSON parsing error: Server returned invalid response"
            continue
        fi
        # Skip HTML and caret lines
        if [[ "$line" =~ ^\<html\> ]] || [[ "$line" =~ ^\^+$ ]]; then
            continue
        fi
        # Clean and output the line
        echo "$line" | sed "s/'//g" | tr '\r' ' '
    done
}

# Function to check if a file contains valid JSON
is_valid_json() {
    local json_file="$1"
    
    if [ ! -f "$json_file" ] || [ ! -s "$json_file" ]; then
        return 1
    fi
    
    # Check file content - must start with { or [ and not contain HTML
    local first_char=$(head -c 1 "$json_file" 2>/dev/null)
    if [[ "$first_char" != "{" && "$first_char" != "[" ]]; then
        return 1
    fi
    
    # Check for HTML content (common in error responses)
    if grep -q '<html>' "$json_file" 2>/dev/null; then
        return 1
    fi
    
    # Final validation with jq if available
    if command -v jq &> /dev/null; then
        jq empty "$json_file" >/dev/null 2>&1
        return $?
    fi
    
    return 0
}

# Function to extract failure details from a single JSON file
extract_failures() {
    local json_file="$1"
    
    if ! is_valid_json "$json_file"; then
        echo "• Test execution failed (invalid response from server)"
        return 0
    fi
    
    # Extract failures using jq
    if command -v jq &> /dev/null; then
        
                # Extract all failure details from Postman's standard structure
        failures=$(jq -r '
            try (
                # Method 1: Standard .run.failures structure
                (.run.failures[]? | 
                 select(.error?) |
                 "• " + (.error.message // .error.test // "Test failed")),
                
                # Method 2: Assertion failures in executions
                (.run.executions[]? | 
                 select(.assertions?) |
                 .assertions[]? |
                 select(.error?) |
                 "• " + (.error.message // .error.test // "Assertion failed")),
                
                # Method 3: Failed tests in response.tests
                (.run.executions[]? |
                 select(.response?) |
                 select(.response.tests?) |
                 .response.tests |
                 to_entries[] |
                 select(.value == false) |
                 "• " + .key),
                
                # Method 4: Any nested error messages
                (.. |
                 select(type == "object" and has("error") and .error.message?) |
                 "• " + .error.message)
            ) catch empty
        ' "$json_file" 2>/dev/null | sanitize_output)
        
        # If no failures extracted, try HTTP errors as fallback
        if [ -z "$failures" ]; then
            failures=$(jq -r '
                try (
                    .run.executions[]? |
                    select(.response.code? and .response.code >= 400) |
                    "• HTTP Error " + (.response.code | tostring) + ": " + (.response.status // "Request failed")
                ) catch empty
            ' "$json_file" 2>/dev/null | sanitize_output)
        fi
        
        # If still no detailed failures found, provide a generic message
        if [ -z "$failures" ]; then
            failure_count=$(jq -r '.run.stats.assertions.failed // 0' "$json_file" 2>/dev/null || echo "0")
            if [ "$failure_count" -gt 0 ]; then
                echo "• $failure_count test assertions failed (detailed error messages not available)"
            else
                echo "• Test execution failed (no detailed error information found)"
            fi
        else
            echo "$failures"
        fi
        
    else
        # Fallback without jq: basic grep patterns for common test failure messages
        {
            # Look for assertion messages
            grep -o '"message":"[^"]*expected[^"]*"' "$json_file" 2>/dev/null | \
            sed 's/"message":"//g' | \
            sed 's/"$//g' | \
            sed 's/^/• /' | \
            head -5
            
            # Look for test names that failed
            grep -o '"test":"[^"]*"' "$json_file" 2>/dev/null | \
            sed 's/"test":"//g' | \
            sed 's/"$//g' | \
            sed 's/^/• /' | \
            head -5
        } | sanitize_output | head -10
        
        # If no specific failures found, show generic message
        if [ -z "$(grep -o '"message":"[^"]*expected[^"]*"' "$json_file" 2>/dev/null)" ]; then
            echo "• Test execution failed (jq not available for detailed error parsing)"
        fi
    fi
}

# Main logic
if [ "$step_outcome" = "failure" ]; then
    echo "🔍 $test_name:"
    
    failure_found=false
    empty_files=0
    total_files=0
    
    for json_file in "${json_files[@]}"; do
        total_files=$((total_files + 1))
        
        if [ -f "$json_file" ]; then
            file_size=$(wc -c < "$json_file" 2>/dev/null || echo "0")
            if [ "$file_size" -gt 0 ]; then
                if is_valid_json "$json_file"; then
                    failures=$(extract_failures "$json_file")
                    if [ -n "$failures" ]; then
                        echo "$failures"
                        failure_found=true
                    fi
                else
                    echo "• Test execution failed (invalid response from server)"
                    empty_files=$((empty_files + 1))
                fi
            else
                echo "• Test execution failed (no test output generated)"
                empty_files=$((empty_files + 1))
            fi
        else
            echo "• Test execution failed (no test output generated)"
            empty_files=$((empty_files + 1))
        fi
    done
    
    if [ "$failure_found" = false ]; then
        if [ "$empty_files" -eq "$total_files" ]; then
            echo "• Test execution failed (no test output generated)"
        else
            echo "• Test failed (no detailed error information available)"
        fi
    fi
fi

# Output for step outcome (always use the actual step outcome)
echo "test_results=$test_name:$step_outcome" 