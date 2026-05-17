# Booking Flow

## Overview
The Booking API is designed around a **single-submission model**. The backend does not store partial or incomplete bookings. The frontend application is responsible for gathering all required booking details locally across multiple UI steps before submitting a complete payload to the `POST /bookings` endpoint.

### 1. Local State Accumulation (UI Flow)
The frontend should implement a state machine or multi-step wizard. The final API request cannot be made until the user reaches the `ReviewBooking` state and all data points are present in the local state.

```mermaid
stateDiagram-v2
    [*] --> GatheringPickup : User starts booking
    
    GatheringPickup --> GatheringDestination : Save Pickup\n(address, lat, lng, h3)
    GatheringDestination --> GatheringPatientInfo : Save Destination\n(address, lat, lng)
    GatheringPatientInfo --> SelectingAmbulance : Save Patient Info\n(type, condition)
    SelectingAmbulance --> ReviewBooking : Save Ambulance ID
    
    ReviewBooking --> Submitting : User clicks "Confirm Booking"
    
    Submitting --> BookingConfirmed : API Returns 201 Created
    Submitting --> ReviewBooking : API Returns 400/500 (Retry)
    
    BookingConfirmed --> [*]
```

### 2. API Submission & Lifecycle
Once the local state is fully populated, the frontend triggers the API submission. The sequence below outlines the final creation step and how to transition the booking into the active simulation phase.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend App
    participant B as Backend API (/bookings)
    
    Note over U, F: Multi-step local state gathering completes
    
    U->>F: Clicks "Confirm Booking"
    Note over F: Construct complete JSON payload<br/>from local component state
    
    F->>B: POST /bookings
    Note right of F: Payload includes:<br/>- ambulance_id<br/>- booking_type, patient_condition<br/>- pickup_address, pickup_lat, pickup_lng, pickup_h3<br/>- destination_address, destination_lat, destination_lng
    
    alt Validation / Server Error
        B-->>F: 400 Bad Request / 500 Internal Error
        F-->>U: Show Error Message & Allow Retry
    else Success
        B-->>F: 201 Created (Returns Booking Object with ID)
        F-->>U: Navigate to Active Map / Tracking View
    end
    
    Note over F, B: Later: Updating Booking Status
    F->>B: PUT /bookings/{id}/status <br/>{ "status": "en_route" }
    Note right of B: Backend starts driver simulation<br/>(Supabase Realtime trip:{id})
    B-->>F: 200 OK
```

### 3. Required Payload Structure Reference
To successfully transition from the `Submitting` state to `BookingConfirmed`, the `POST /bookings` payload must match this exact schema:

```json
{
  "ambulance_id": "uuid-string",
  "booking_type": "medis | sosial | jenazah | darurat",
  "patient_condition": "String description of condition",
  "pickup_address": "String address",
  "pickup_lat": -6.200000,
  "pickup_lng": 106.816666,
  "pickup_h3": "876526b33ffffff",
  "destination_address": "String address",
  "destination_lat": -6.210000,
  "destination_lng": 106.820000
}
```
*(Note: Do not send the `user_id` in the body; the backend resolves this automatically from the JWT payload).*
