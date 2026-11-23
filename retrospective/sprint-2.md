# RETROSPECTIVE – TEAM 6

---

# 1. PROCESS MEASURES

## 1.1 Macro Statistics

| Metric | Committed / Planned | Completed / Actual |
|:---|:---:|:---:|
| Number of Stories | 4 | 4 |
| Total Story Points | 19 | 19 |
| Total Team Hours | 64h 00m | 63h 55m |

## 1.2 Detailed Statistics

| Story | # Tasks | Points | Estimated Hours | Actual Hours |
|:---|---:|---:|---:|---:|
| #0 – Technical Tasks | 10 | – | 26h 00m | 26h 35m |
| MH-05: Provide party requirements | 7 | 3 | 6h 00m | 5h 25m |
| MH-06: Change a booking | 10 | 8 | 15h 30m | 15h 25m |
| MH-07: Reserve for an hiker | 11 | 5 | 12h 00m | 11h 35m |
| MH-08: Cancel a booking | 7 | 3 | 4h 30m | 4h 55m |
| TOTAL:   | 45 | 19 | 64h 00m | 63h 55m |

*Note: Story #0 includes technical tasks not directly associated with any user story (YouTrack "No parent": Sprint Planning, Daily Scrum, Demo and retrospective preparation, YouTrack update, Code review, Sprint 1 stakeholder feedback, organization and requirement clarification, Docker deployment setup, deployment verification, technical debt). Story points are therefore not applicable.*


## 1.3 Hours per Task per Person

### 1.3.1 Actual Hours per Task per Person

| Team Member | # Tasks | Average (hours/task) | Standard Deviation |
|:---|:---:|:---:|:---:|
| Federico Morello | 16 | 0h 59m | 0h 40m |
| Gaia Martignone | 14 | 1h 09m | 0h 33m |
| Jenisse Vereau | 15 | 1h 04m | 0h 43m |
| Luca Robustelli | 17 | 0h 56m | 0h 27m |

### 1.3.2 Estimated Hours per Task per Person

| Team Member | # Tasks | Average (hours/task) | Standard Deviation |
|:---|:---:|:---:|:---:|
| Federico Morello | 16 | 1h 01m | 0h 39m |
| Gaia Martignone | 14 | 1h 05m | 0h 33m |
| Jenisse Vereau | 15 | 1h 03m | 0h 42m |
| Luca Robustelli | 17 | 0h 59m | 0h 27m |

*Note: For shared tasks (e.g. Sprint Planning, Daily Scrum, YouTrack update), estimated hours were divided equally among the team members involved. Actual hours are the time each member logged on the task. Standard deviation is the population standard deviation.*

## 1.4 Total Task Estimation Error Ratio


| Metric | Value |
|:---|---:|
| Total Hours Estimated | 64h 00m |
| Total Hours Spent | 63h 55m |
| **Estimation Error Ratio** | **+0.0013 (+0.13%)** |

The estimation error ratio is calculated using the following formula:

$$\frac{Total\ Hours\ Estimated}{Total\ Hours\ Spent} - 1 = \frac{\sum_i estimation_{task_i}}{\sum_i spent_{task_i}} - 1 = \frac{3840}{3835} - 1 \approx +0.0013 = +0.13\%$$

---

# 2. QUALITY MEASURES

## 2.1 Unit Testing

| Metric | Value |
|:---|---:|
| Total Hours Estimated | 5h 15m |
| Total Hours Spent | 5h 10m |
| Automated Unit Test Cases | 597 |
| Code Coverage (all tests) | 93.4% |

*Note: Backend suite (Vitest, v8 coverage on `backend/src`): 761 tests in 76 files, all passing. Coverage figure is statement coverage (lines 94.4%, branches 92.1%, functions 89.9%).*

## 2.2 Integration Testing

| Metric | Value |
|:---|---:|
| Total Hours Estimated | 4h 45m |
| Total Hours Spent | 4h 40m |

## 2.3 End-to-End (E2E) Testing

| Metric | Value |
|:---|---:|
| Total Hours Estimated | 2h 00m |
| Total Hours Spent | 2h 00m |

## 2.4 Code Review

| Metric | Value |
|:---|---:|
| Total Hours Estimated | 3h 00m |
| Total Hours Spent | 3h 00m |

---

# 3. GENERAL ASSESSMENT

## 3.1 What caused your errors in estimation (if any)?

Overall estimation was accurate (+0.13% error), helped by the experience gained in Sprint 1. The small deviations we had came from:

- **Mid-sprint requirement changes:** clarifications from the Product Owner arrived during the sprint and changed the scope of some tasks.
- **Testing estimates:** testing hours were allocated in proportion to story points, which led to slight under- or overestimation on a few tasks.
- **Tight estimates:** some tasks, such as the Docker deployment setup, were completed on time but with almost no margin.

## 3.2 What lessons did you learn (both positive and negative) in this sprint?

**Positive:**
- Communication and coordination improved: the team made suggestions and cleared doubts together throughout the sprint.
- Explicitly managing technical debt (a dedicated task this sprint) stops problems from accumulating.
- Investing in a scalable, maintainable architecture reduces friction when requirements change.

**Negative:**
- Changes introduced mid-sprint caused unexpected conflicts and extra work, especially on existing tests.
- Some open issues were resolved only in the last days of the sprint, or not at all, leaving little time for adjustments.

## 3.3 Which improvement goals set in the previous retrospective were you able to achieve?

- **Estimation accuracy:** the estimation error dropped from −3.40% to +0.13%.
- **Less time on organization:** we coordinated and made decisions faster, leaving more time for development.
- **Team coordination:** the team worked more collaboratively, with fewer internal conflicts and a more consistent working pace.
- **Buffer for adjustments:** we planned time for adjustments, knowing that some open issues are resolved only late in the sprint.

## 3.4 Which ones were you not able to achieve? Why?

All committed stories were completed, but some aspects still need attention:

- **Daily Scrums:** they were hard to hold regularly because of different schedules and personal commitments, which sometimes made it harder to stay aligned.
- **Testing time:** on a few tasks testing still exceeded its estimate, because mid-sprint changes forced us to fix and update existing tests.
- **Technical debt:** it increased during the sprint and will affect future sprint planning.

## 3.5 Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)

| Goal | How to achieve it |
|:---|:---|
| Streamline deployment | Set up a CI pipeline with GitHub Actions that builds the Docker images automatically once all automated tests pass. |
| More regular Daily Scrums | Agree on Daily Scrum times in advance, based on everyone's availability. |
| Handle mid-sprint changes better | Keep tests easy to adapt and react faster to unexpected issues, reducing the time spent fixing existing tests. |
| Keep technical debt under control | Keep a dedicated technical-debt task in every sprint. |
| Avoid overcommitting | Leave room for improvements and adjustments instead of committing to a too tight set of stories. |

## 3.6 One thing you are proud of as a Team!

We are proud of how much we have improved since the start of the project. This sprint ran smoothly and with little organizational friction, in a calm and collaborative environment. We are more familiar with the codebase and more independent in our tasks. We delivered all committed stories while staying on track with our goals and our estimated hours.
