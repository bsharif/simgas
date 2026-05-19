Product Requirements Document (PRD)

Anaesthesia Simulation Monitor App

⸻

1. Product Overview

Product Name

SimGas (working title)

Vision

Create a high-fidelity, interactive anaesthetic monitoring simulation app for trainees, consultants, medical students, and simulation faculty. The app presents a realistic physiological monitor and responds dynamically to user interventions during simulated peri-operative emergencies and routine anaesthetic management.

The application should replicate real-world anaesthetic decision-making under pressure, with physiologically plausible responses to drugs, airway manoeuvres, ventilation changes, fluid therapy, and emergencies.

Initial launch target is iOS (iPhone + iPad) with architecture designed for future Android expansion.

⸻

2. Goals & Objectives

Primary Goals

* Provide immersive anaesthetic crisis simulation
* Improve pattern recognition of physiological deterioration
* Reinforce management algorithms and situational awareness
* Enable self-directed learning without simulation centre access
* Support rapid scenario creation by educators

Secondary Goals

* Create a platform for future multiplayer/team simulation
* Enable remote teaching and assessment
* Potential integration with external hardware/simulation centres
* Build reusable physiology simulation engine

⸻

3. Target Users

Primary Users

* Anaesthetic trainees (CT1–ST7)
* Consultant anaesthetists
* ODPs / Anaesthetic nurses
* Medical students
* ICU trainees
* Emergency medicine trainees

Secondary Users

* Simulation faculty
* Universities
* NHS education departments
* ALS/ATLS course providers

⸻

4. Core User Stories

Trainee

* “I want to practise recognising malignant hyperthermia.”
* “I want to learn how capnography changes during oesophageal intubation.”
* “I want realistic monitor responses to my interventions.”

Educator

* “I want to configure a custom scenario for trainees.”
* “I want to pause, rewind, and replay simulations.”
* “I want to review trainee actions and timings.”

Student

* “I want guided scenarios with hints.”
* “I want explanations of monitor changes.”

⸻

5. Core Features

5.1 Physiological Monitor

Displayed Parameters

Mandatory

* ECG waveform
* Heart rate
* SpO₂ waveform + saturation
* NIBP
* IBP (optional)
* Respiratory rate
* ETCO₂ waveform
* FiO₂
* Volatile agent concentration
* Temperature

Optional/Future

* CVP
* BIS
* Neuromuscular monitoring
* Cardiac output
* ICP
* EEG
* Ventilator loops

Design Requirements

* Realistic monitor aesthetics
* Smooth waveform animations
* Configurable colour schemes
* Portrait and landscape support
* Dark mode support

⸻

5.2 Interactive Interventions

Users must be able to perform interventions and observe physiological responses.

Airway

* Jaw thrust
* Oropharyngeal airway
* Supraglottic airway
* Intubation
* Cricoid pressure
* Suction
* Extubation

Ventilation

* Adjust FiO₂
* Adjust tidal volume
* Change RR
* PEEP changes
* Manual ventilation
* Disconnect circuit

Drugs

Induction

* Propofol
* Ketamine
* Thiopentone

Vasopressors/Inotropes

* Metaraminol
* Phenylephrine
* Ephedrine
* Adrenaline

Other

* Opioids
* Muscle relaxants
* Sugammadex
* Volatile agents
* Insulin/glucose
* Antibiotics

Procedures

* Fluid bolus
* Defibrillation
* CPR
* Chest decompression
* Arterial line insertion

⸻

5.3 Clinical Scenarios

Included at Launch

Airway

* Oesophageal intubation
* Laryngospasm
* Bronchospasm
* Difficult airway
* Circuit disconnection

Cardiovascular

* Anaphylaxis
* Bradycardia
* SVT
* VF/VT arrest
* Haemorrhagic shock

Respiratory

* Hypoxia
* Tension pneumothorax
* Pulmonary embolism

Metabolic

* Malignant hyperthermia
* Hyperkalaemia
* Hypoglycaemia

Regional

* LAST (Local Anaesthetic Systemic Toxicity)
* High spinal

Obstetric

* Amniotic fluid embolism
* PPH

⸻

5.4 Simulation Engine

Requirements

The backend physiology engine should:

* Continuously update physiological state
* Model interactions between systems
* Allow deterioration if untreated
* Allow improvement after correct intervention
* Support probabilistic variation

Example Logic

Oesophageal Intubation

* ETCO₂ rapidly falls
* SpO₂ slowly declines
* Tachycardia then bradycardia
* Corrective intubation restores parameters

Anaphylaxis

* Hypotension
* Bronchospasm waveform
* Tachycardia
* Responsive to adrenaline + fluids

Engine Principles

* Event-driven
* Time-based deterioration
* Weighted intervention responses
* Modular scenario scripting

⸻

6. Modes

6.1 Guided Mode

* Prompts/hints enabled
* Educational overlays
* Pause + explanation

6.2 Exam Mode

* No hints
* Scoring enabled
* Time pressure

6.3 Free Play

* User chooses interventions freely
* Sandbox physiology

6.4 Instructor Mode

* Real-time parameter manipulation
* Trigger events manually
* Freeze/resume

⸻

7. Scoring & Feedback

Metrics

* Time to diagnosis
* Correct intervention order
* Patient outcome
* Adherence to guidelines
* Critical omissions

Feedback

* Timeline replay
* Annotated mistakes
* Suggested reading
* Benchmark comparison

⸻

8. Technical Requirements

8.1 Platform

Phase 1

* Native iOS app
* iPhone + iPad support

Phase 2

* Android support

Phase 3

* Web version
* Multiplayer/cloud simulation

⸻

8.2 Suggested Tech Stack

Frontend

Recommended

* SwiftUI
* Combine
* Metal/CoreAnimation for waveform rendering

Alternative Cross-Platform Option

* Flutter
* Shared simulation engine

Rationale

Native iOS preferred initially for:

* Performance
* Low-latency waveform rendering
* Better Apple Pencil/iPad support
* Faster MVP delivery

⸻

8.3 Architecture

Core Modules

* Physiology engine
* Scenario engine
* UI renderer
* Audio engine
* Analytics/logging

State Management

Reactive architecture:

* Observable simulation state
* Tick-based engine updates

⸻

8.4 Data Model

Example Structure

{
  "patient": {
    "age": 45,
    "weight": 80,
    "asa": 2
  },
  "vitals": {
    "hr": 82,
    "spo2": 99,
    "etco2": 4.8
  },
  "scenario": {
    "type": "anaphylaxis",
    "severity": "moderate"
  }
}

⸻

9. UX/UI Requirements

Key Principles

* Extremely rapid readability
* Minimal latency
* Touch-first interactions
* Realistic monitor feel

Interaction Model

Bottom Toolbar

* Drugs
* Airway
* Ventilation
* Procedures

Side Panel

* Event log
* Current actions
* Hints

⸻

10. Audio Requirements

Included Sounds

* ECG beeps
* Pulse tone variation with saturation
* NIBP inflation
* Ventilator sounds
* Alarm escalation

Alarm Behaviour

* Configurable thresholds
* Realistic prioritisation
* Silencing options

⸻

11. Non-Functional Requirements

Performance

* <16ms frame rendering target
* Smooth 60fps waveform animation

Reliability

* Offline functionality
* No network dependency for core scenarios

Security

* No patient-identifiable data
* GDPR compliant

Accessibility

* Colourblind-friendly mode
* Dynamic text sizing
* VoiceOver compatibility

⸻

12. Future Features

Phase 2+

* Multiplayer simulations
* Airway camera/video
* Voice recognition
* AI-driven examiner
* External monitor display support
* Apple Vision Pro support
* BLE integration with simulation mannequins

Advanced Physiology

* Pharmacokinetic/pharmacodynamic modelling
* Ventilator mechanics
* Dynamic blood gas modelling

Education Features

* Curriculum mapping
* FRCA exam prep
* LMS integration
* Certificates/CPD tracking

⸻

13. Monetisation

Options

Freemium

* Limited free scenarios
* Premium subscriptions

Institutional Licensing

* NHS trusts
* Universities
* Simulation centres

Marketplace

* Paid scenario packs
* Community-created scenarios

⸻

14. Risks & Challenges

Technical

* Realistic physiology complexity
* Waveform rendering performance
* Balancing realism vs usability

Clinical

* Ensuring guideline accuracy
* Avoiding unsafe educational content

Regulatory

* Position clearly as educational simulation
* Avoid classification as medical device

⸻

15. MVP Definition

MVP Scope

Included

* iOS app
* 5 scenarios
* ECG/SpO₂/NIBP/ETCO₂
* Basic interventions
* Guided + exam mode

Excluded

* Multiplayer
* Cloud sync
* Instructor dashboard
* Android support

⸻

16. Success Metrics

Usage

* Daily active users
* Scenario completion rates
* Session duration

Educational

* User confidence improvement
* Repeat usage
* Faculty adoption

Technical

* Crash-free sessions >99%
* FPS stability
* Low battery usage

⸻

17. Suggested Roadmap

Phase 1 — MVP (3–6 months)

* Basic monitor
* Core physiology engine
* 5 emergency scenarios

Phase 2 (6–12 months)

* More scenarios
* Analytics
* Instructor mode
* iPad optimisation

Phase 3 (12–24 months)

* Android
* Multiplayer
* Cloud profiles
* AI debriefing