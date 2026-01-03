# Target

**(impl/)microservices/service-{SERVICE}/functions/.env.{ENV}**

# Sources

* **env/functions/**
  * **.env.ALL-before**
  * **.env.{ENV}**
  * **.env.ALL-after**
* **(impl/)microservices/service-{SERVICE}/functions/.env.{ENV}.template**

# Features

- `-KEY` in .template removes inherited envar
- placeholder substitution
- inheritance/precedence cascade
- per specific environment (ENV)
- before/after all environments
- .gitignore wrangling

# Protection

## .gitignore

In each functions folder

- Deny .env.*
- Permit !*.template
