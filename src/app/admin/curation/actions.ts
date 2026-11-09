'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { publishEvent, type IntakeResult } from '@/lib/events/intake/publishEvent';

// Mock Amazon SES Wrapper
async function sendSesNotification(email: string, title: string) {
  console.log(`[SES MOCK] Email sent to ${email} for event "${title}" - "Your Content is Live!"`);
  // TODO: Implement actual AWS SES sendEmail call using aws-sdk or nodemailer
}

export async function acceptAction(id: string, type: string, email: string, title: string) {
  try {
    if (type === 'event') {
      await sql`UPDATE events SET status = 'approved', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'webcam') {
      await sql`UPDATE webcams SET status = 'live', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'photo') {
      await sql`UPDATE photos SET status = 'approved', updated_at = NOW() WHERE id = ${id}`;
    }
    
    if (email) {
      await sendSesNotification(email, title);
    }
    
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error) {
    console.error('Accept Action Failed:', error);
    return { success: false, error: 'Database error' };
  }
}

export async function needsAttentionAction(id: string, type: string) {
  try {
    if (type === 'event') {
      await sql`UPDATE events SET status = 'needs_attention', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'webcam') {
      await sql`UPDATE webcams SET status = 'needs_attention', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'photo') {
      await sql`UPDATE photos SET status = 'needs_attention', updated_at = NOW() WHERE id = ${id}`;
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error) {
    console.error('Needs Attention Action Failed:', error);
    return { success: false, error: 'Database error' };
  }
}

export async function stealthLegalHoldAction(id: string, type: string, submittingEmail: string, rawContent: string) {
  try {
    // Atomic Transaction for Stealth Legal Hold
    await sql`BEGIN`;
    
    await sql`
      INSERT INTO legal_quarantine (original_item_id, item_type, submitting_user_email, submission_timestamp, raw_submission_content)
      VALUES (${id}, ${type}, ${submittingEmail}, NOW(), ${rawContent}::jsonb)
    `;

    if (type === 'event') {
      await sql`UPDATE events SET status = 'legal_hold', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'webcam') {
      await sql`UPDATE webcams SET status = 'legal_hold', updated_at = NOW() WHERE id = ${id}`;
    } else if (type === 'photo') {
      await sql`UPDATE photos SET status = 'legal_hold', updated_at = NOW() WHERE id = ${id}`;
    }
    
    await sql`COMMIT`;
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error) {
    await sql`ROLLBACK`;
    console.error('Stealth Legal Hold Action Failed:', error);
    return { success: false, error: 'Database transaction error' };
  }
}

export async function hardTrashAction(id: string, type: string) {
  try {
    if (type === 'event') {
      await sql`DELETE FROM events WHERE id = ${id}`;
    } else if (type === 'webcam') {
      await sql`DELETE FROM webcams WHERE id = ${id}`;
    } else if (type === 'photo') {
      await sql`DELETE FROM photos WHERE id = ${id}`;
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error) {
    console.error('Hard Trash Action Failed:', error);
    return { success: false, error: 'Database error' };
  }
}

export async function editItemAction(id: string, type: string, updates: any) {
  try {
    if (type === 'event') {
      // Very basic raw SQL UPDATE construction for known editable fields
      await sql`
        UPDATE events 
        SET 
          title = ${updates.title}, 
          category = ${updates.category}, 
          venue = ${updates.venue}, 
          details = ${updates.details},
          city_name = ${updates.city_name},
          state_name = ${updates.state_name},
          start_time = ${updates.start_time},
          event_date = ${updates.event_date}::timestamp,
          social_urls = ${updates.social_urls},
          official_info_url = ${updates.official_info_url},
          affiliate_url = ${updates.affiliate_url},
          registration_url = ${updates.registration_url},
          venue_address = ${updates.venue_address},
          hosting_entity = ${updates.hosting_entity},
          contact_email = ${updates.contact_email},
          contact_phone = ${updates.contact_phone},
          event_flyer_url = ${updates.event_flyer_url},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (type === 'photo') {
      await sql`
        UPDATE photos
        SET
          title = ${updates.title},
          city_name = ${updates.city_name},
          state_name = ${updates.state_name},
          display_order = ${updates.display_order},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    } else if (type === 'webcam') {
      await sql`
        UPDATE webcams
        SET
          title = ${updates.title},
          city_name = ${updates.city_name},
          state_name = ${updates.state_name},
          display_order = ${updates.display_order},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Edit Action Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}

export async function cloneWebcamAction(updates: any) {
  try {
    await sql`
      INSERT INTO webcams (
        title, city_name, state_name, embed_url, image_url, kind, source, display_order, status
      ) VALUES (
        ${updates.title}, ${updates.city_name}, ${updates.state_name}, 
        ${updates.embed_url || null}, ${updates.image_url || null},
        ${updates.kind || 'youtube'}, ${updates.source || 'Admin Clone'}, 
        ${updates.display_order || 1}, 'live'
      )
    `;
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Clone Webcam Action Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}

export async function syndicateWebcamToCitiesAction(webcamData: any, citiesList: string[]) {
  try {
    for (const city of citiesList) {
      const trimmed = city.trim();
      if (!trimmed) continue;
      await sql`
        INSERT INTO webcams (
          title, city_name, state_name, embed_url, image_url, kind, source, display_order, status
        ) VALUES (
          ${webcamData.title}, ${trimmed}, ${webcamData.state_name}, 
          ${webcamData.embed_url || null}, ${webcamData.image_url || null},
          ${webcamData.kind || 'youtube'}, ${webcamData.source || 'Syndicated Feed'}, 
          ${webcamData.display_order || 1}, 'live'
        )
      `;
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Syndicate Webcam Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}

/** Human-readable summary of a publishEvent() result for admin alerts. */
function describeIntake(r: IntakeResult): string {
  const why = r.reasons.length ? ` (${r.reasons.join(', ')})` : '';
  return `${r.outcome}${why}${r.detail ? `: ${r.detail}` : ''}`;
}

export async function cloneEventAction(updates: any) {
  try {
    // Location = exactly what the admin has in the edit form. No defaults.
    const result = await publishEvent({
      origin: 'admin_curation',
      title: updates.title,
      details: updates.details,
      category: updates.category,
      venue: updates.venue,
      venueAddress: updates.venue_address,
      hostingEntity: updates.hosting_entity,
      startTime: updates.start_time,
      eventDate: updates.event_date,
      location: {
        city: updates.city_name || null,
        region: updates.state_name || null,
        address: updates.venue_address || null,
      },
      source: 'Admin Clone',
      affiliateUrl: updates.affiliate_url,
      registrationUrl: updates.registration_url,
      contactEmail: updates.contact_email,
      contactPhone: updates.contact_phone,
      officialInfoUrl: updates.official_info_url,
      socialUrls: updates.social_urls,
      eventFlyerUrl: updates.event_flyer_url,
    });
    revalidatePath('/admin/curation');
    if (result.outcome === 'rejected' || result.outcome === 'retry') {
      return { success: false, error: `Clone not saved: ${describeIntake(result)}`, outcome: result.outcome, reasons: result.reasons };
    }
    return { success: true, id: result.id, outcome: result.outcome, reasons: result.reasons, message: `Clone ${describeIntake(result)}` };
  } catch (error: any) {
    console.error('Clone Action Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}

export async function clonePhotoAction(updates: any) {
  try {
    await sql`
      INSERT INTO photos (
        title, city_name, state_name, image_url, source, display_order, status, photographer_name, rights_released
      ) VALUES (
        ${updates.title}, ${updates.city_name}, ${updates.state_name}, ${updates.image_url}, 'Admin Clone', ${updates.display_order}, 'approved', 'Admin', true
      )
    `;
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Clone Photo Action Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}


export async function trustSourceAction(email: string) {
  try {
    // Add to venue_profiles as trusted source (since it has a contactEmail and isTrustedSource field)
    await sql`
      INSERT INTO venue_profiles (venue_name, city_name, contact_email, is_trusted_source) 
      VALUES (${'Trusted Submitter ' + email}, 'Global', ${email}, true)
      ON CONFLICT (venue_name) DO UPDATE SET is_trusted_source = true, contact_email = ${email}
    `;
    return { success: true };
  } catch (error) {
    console.error('Trust Source Action Failed:', error);
    return { success: false, error: 'Database error' };
  }
}

export async function massReleaseAction(items: any[]) {
  try {
    // We update all ai_approved events to approved in one go
    await sql`UPDATE events SET status = 'approved', updated_at = NOW(), follow_up_sent = false WHERE status = 'ai_approved'`;
    
    // In a real app we would loop and fire SES emails here for each item
    for (const item of items) {
      if (item.email) await sendSesNotification(item.email, item.title);
    }

    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error) {
    console.error('Mass Release Action Failed:', error);
    return { success: false, error: 'Database error' };
  }
}

export async function createFranchiseAction(name: string, email: string, rawLocations: string) {
  try {
    const res = await sql`
      INSERT INTO franchises (name, corporate_email) 
      VALUES (${name}, ${email}) 
      RETURNING id
    `;
    const franchiseId = res.rows[0].id;

    const locs = rawLocations.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    
    for (const loc of locs) {
      // If the location has pipe characters (like from a scraped table), try to extract just city/state
      if (loc.includes('|')) {
        const parts = loc.split('|').map(s => s.trim());
        // Usually looks like "City Name | 123 Address | City | State | Zip"
        // Try to find the 2-letter state
        let state = parts.find(p => p.length === 2 && /^[A-Z]{2}$/i.test(p));
        let city = parts[0]; 
        
        await sql`
          INSERT INTO franchise_locations (franchise_id, city_name, state_name, local_address)
          VALUES (${franchiseId}, ${city}, ${state || null}, ${loc})
        `;
      } else {
        const parts = loc.split(/[\s,]+/);
        let state = parts.length > 1 ? parts.pop() : '';
        if (state && state.length !== 2) {
          parts.push(state);
          state = '';
        }
        const city = parts.join(' ').trim();
        if (city) {
          await sql`
            INSERT INTO franchise_locations (franchise_id, city_name, state_name, local_address)
            VALUES (${franchiseId}, ${city}, ${state || null}, ${loc})
          `;
        }
      }
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (err) {
    console.error('Create Franchise Failed:', err);
    return { success: false, error: 'Database error' };
  }
}

export async function adminOverrideMassPublishAction(eventId: number, franchiseId: number) {
  try {
    const eventRes = await sql`SELECT * FROM events WHERE id = ${eventId}`;
    const originalEvent = eventRes.rows[0];
    if (!originalEvent) throw new Error("Event not found");

    const locsRes = await sql`SELECT * FROM franchise_locations WHERE franchise_id = ${franchiseId}`;
    const locations = locsRes.rows;
    if (locations.length === 0) {
      throw new Error(`Cannot mass publish: Zero locations found in the franchise library (ID: ${franchiseId}). Please rebuild the Franchise in the Franchises tab.`);
    }

    const counts = { published: 0, pending_review: 0, duplicate: 0, rejected: 0, retry: 0 };
    const problems: string[] = [];
    for (const loc of locations) {
      if (loc.city_name === originalEvent.city_name && loc.state_name === originalEvent.state_name) continue;

      // Location = the franchise location row exactly as entered (no defaults).
      const localAddress = loc.local_address ? String(loc.local_address).replace(/\s*\|\s*/g, ', ') : null;
      const result = await publishEvent({
        origin: 'admin_curation',
        title: originalEvent.title,
        details: originalEvent.details,
        category: originalEvent.category,
        venue: originalEvent.venue,
        venueAddress: localAddress,
        hostingEntity: originalEvent.hosting_entity,
        startTime: originalEvent.start_time,
        eventDate: originalEvent.event_date,
        location: {
          city: loc.city_name || null,
          region: loc.state_name || null,
          address: localAddress,
        },
        source: 'Corporate Franchise Fan Out',
        franchiseId,
        affiliateUrl: originalEvent.affiliate_url,
        registrationUrl: originalEvent.registration_url,
        userName: originalEvent.user_name,
        userEmail: originalEvent.user_email,
        userPhone: originalEvent.user_phone,
        contactEmail: originalEvent.contact_email,
        contactPhone: originalEvent.contact_phone,
        officialInfoUrl: originalEvent.official_info_url,
        socialUrls: originalEvent.social_urls,
        eventFlyerUrl: originalEvent.event_flyer_url,
      });
      counts[result.outcome]++;
      if (result.outcome !== 'published' && result.outcome !== 'duplicate') {
        problems.push(`${loc.city_name || '?'}${loc.state_name ? ', ' + loc.state_name : ''}: ${describeIntake(result)}`);
      }
    }

    await sql`UPDATE events SET status = 'approved', updated_at = NOW() WHERE id = ${eventId}`;
    revalidatePath('/admin/curation');
    const summary = `Fan-out: ${counts.published} published, ${counts.pending_review} pending review, ${counts.duplicate} duplicates, ${counts.rejected} rejected, ${counts.retry} retry later.`;
    if (counts.rejected || counts.retry) {
      // success:false makes the curation UI alert the admin with the per-location reasons.
      return { success: false, error: `${summary}\n${problems.join('\n')}`, counts };
    }
    return { success: true, counts, message: problems.length ? `${summary}\n${problems.join('\n')}` : summary };
  } catch (error: any) {
    console.error('Admin Override Failed:', error);
    return { success: false, error: error.message || 'Database error' };
  }
}

export async function getFranchiseLocationsAction(franchiseId: number) {
  try {
    const { rows } = await sql`SELECT * FROM franchise_locations WHERE franchise_id = ${franchiseId} ORDER BY state_name, city_name ASC`;
    return { success: true, locations: rows };
  } catch (error: any) {
    console.error('Failed to get franchise locations:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteFranchiseLocationAction(locationId: number) {
  try {
    await sql`DELETE FROM franchise_locations WHERE id = ${locationId}`;
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete franchise location:', error);
    return { success: false, error: error.message };
  }
}

export async function appendFranchiseLocationsAction(franchiseId: number, rawLocations: string) {
  try {
    const locs = rawLocations.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    
    for (const loc of locs) {
      if (loc.includes('|')) {
        const parts = loc.split('|').map(s => s.trim());
        let state = parts.find(p => p.length === 2 && /^[A-Z]{2}$/i.test(p));
        let city = parts[0]; 
        await sql`
          INSERT INTO franchise_locations (franchise_id, city_name, state_name, local_address)
          VALUES (${franchiseId}, ${city}, ${state || null}, ${loc})
        `;
      } else {
        const parts = loc.split(/[\s,]+/);
        let state = parts.length > 1 ? parts.pop() : '';
        if (state && state.length !== 2) {
          parts.push(state);
          state = '';
        }
        const city = parts.join(' ').trim();
        if (city) {
          await sql`
            INSERT INTO franchise_locations (franchise_id, city_name, state_name, local_address)
            VALUES (${franchiseId}, ${city}, ${state || null}, ${loc})
          `;
        }
      }
    }
    revalidatePath('/admin/curation');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to append franchise locations:', error);
    return { success: false, error: error.message };
  }
}
